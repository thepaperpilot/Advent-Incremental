import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import MainDisplay from "features/resources/MainDisplay.vue";

import Sqrt from "components/math/Sqrt.vue";
import {
    createCollapsibleMilestones,
    createCollapsibleModifierSections,
    setUpDailyProgressTracker
} from "data/common";
import { createBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createMilestone } from "features/milestones/milestone";
import { createResource } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier } from "game/modifiers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderRow } from "util/vue";
import { computed, ref } from "vue";
import { createBuyable, GenericBuyable } from "features/buyable";
import metal from "./metal";
import plastic from "./plastic";
import paper from "./paper";
import dyes from "./dyes";
import SqrtVue from "components/math/Sqrt.vue";
import { globalBus } from "game/events";
import { main } from "data/projEntry";
import { createHotkey } from "features/hotkey";
import HotkeyVue from "components/Hotkey.vue";
import { createCostRequirement } from "game/requirements";

const id = "letters";
const day = 14;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Letters";
    const color = "antiquewhite";

    const letters = createResource<DecimalSource>(0, "letters processed");

    const processingProgress = persistent<DecimalSource>(0);
    const processingProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        borderStyle: "border-color: black",
        baseStyle: "margin-top: -1px",
        fillStyle: "margin-top: -1px; transition-duration: 0s; background: black",
        progress: () => Decimal.div(processingProgress.value, computedProcessingCooldown.value)
    }));
    const process = createClickable(() => ({
        display: {
            title: jsx(() => (
                <h3>
                    Process letters <HotkeyVue hotkey={processHK} />
                </h3>
            )),
            description: jsx(() => (
                <>
                    Process {format(computedLettersGain.value, 1)} letters
                    <br />
                    {render(processingProgressBar)}
                </>
            ))
        },
        style: {
            minHeight: "80px"
        },
        visibility: () => showIf(Decimal.lt(totalLetters.value, 8e9)),
        canClick: () =>
            Decimal.gte(processingProgress.value, computedProcessingCooldown.value) &&
            (!main.isMastery.value || masteryEffectActive.value),
        onClick() {
            if (Decimal.lt(processingProgress.value, computedProcessingCooldown.value)) {
                return;
            }
            const amount = Decimal.div(processingProgress.value, computedProcessingCooldown.value)
                .floor()
                .max(1);
            letters.value = Decimal.times(amount, computedLettersGain.value)
                .add(letters.value)
                .min(8e9);
            processingProgress.value = 0;
        }
    }));

    const processHK = createHotkey(() => ({
        key: "l",
        description: "Process letters",
        onPress: () => {
            if (process.canClick.value) process.onClick();
        },
        enabled: noPersist(main.days[day - 1].opened)
    }));

    const metalBuyable = createBuyable(() => ({
        display: {
            title: "Sorting Machine",
            description:
                "Use a mechanic sorting machine to speed up how quickly you process letters",
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(metalBuyable.amount.value, 2).add(1))}x</>
            ))
        },
        requirements: createCostRequirement(() => ({
            resource: metal.metal,
            cost() {
                return Decimal.pow(10, metalBuyable.amount.value).times(1e21);
            }
        })),
        visibility: () => showIf(!main.isMastery.value || masteryEffectActive.value)
    })) as GenericBuyable;
    const plasticBuyable = createBuyable(() => ({
        display: {
            title: "Plastic Bins",
            description:
                "Use various plastic bins to allow you to process larger quantities of letters at once",
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(plasticBuyable.amount.value, 2).add(1))}x</>
            ))
        },
        requirements: createCostRequirement(() => ({
            resource: plastic.plastic,
            cost() {
                return Decimal.pow(1.5, plasticBuyable.amount.value).times(1e9);
            }
        })),
        visibility: () => showIf(!main.isMastery.value || masteryEffectActive.value)
    })) as GenericBuyable;
    const paperBuyable = createBuyable(() => ({
        display: {
            title: "Printed Labels",
            description: "Use printed labels to improve how many letters you can process at once",
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(paperBuyable.amount.value, 2).add(1))}x</>
            ))
        },
        requirements: createCostRequirement(() => ({
            resource: paper.paper,
            cost() {
                return Decimal.pow(3, paperBuyable.amount.value).times(1e38);
            }
        })),
        visibility: () => showIf(!main.isMastery.value || masteryEffectActive.value)
    })) as GenericBuyable;
    const buyables = { metalBuyable, plasticBuyable, paperBuyable };

    const autoSmeltingMilestone = createMilestone(() => ({
        display: {
            requirement: "100 Letters Processed",
            effectDisplay: "Double mining speed for every letters processed milestone"
        },
        shouldEarn: () => Decimal.gte(totalLetters.value, 100)
    }));
    const miningMilestone = createMilestone(() => ({
        display: {
            requirement: "1000 Letters Processed",
            effectDisplay: jsx(() => (
                <>
                    Mine <SqrtVue>Blue Dye</SqrtVue> additional ore each operation
                </>
            ))
        },
        shouldEarn: () => Decimal.gte(totalLetters.value, 1000),
        visibility: () => showIf(autoSmeltingMilestone.earned.value)
    }));
    const synergyMilestone = createMilestone(() => ({
        display: {
            requirement: "10,000 Letters Processed",
            effectDisplay:
                "Improve how much your experience processing letters allows you to process more letters"
        },
        shouldEarn: () => Decimal.gte(totalLetters.value, 10000),
        visibility: () => showIf(miningMilestone.earned.value)
    }));
    const industrialCrucibleMilestone = createMilestone(() => ({
        display: {
            requirement: "100,000 Letters Processed",
            effectDisplay: jsx(() => (
                <>
                    "Industrial Crucible" also multiplies the auto smelting multi by{" "}
                    <Sqrt>amount</Sqrt>
                </>
            ))
        },
        shouldEarn: () => Decimal.gte(totalLetters.value, 100000),
        visibility: () => showIf(synergyMilestone.earned.value)
    }));
    const milestones = {
        autoSmeltingMilestone,
        miningMilestone,
        synergyMilestone,
        industrialCrucibleMilestone
    };
    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(milestones);

    const synergy = computed(() => {
        let amount = Decimal.add(totalLetters.value, 1);
        if (synergyMilestone.earned.value) {
            const preSoftcap = Decimal.log2(10001).add(1);
            amount = preSoftcap.add(amount.sub(9999).sqrt());
        } else {
            amount = Decimal.log2(amount).add(1);
        }
        if (masteryEffectActive.value) {
            amount = Decimal.pow(amount, 2);
        }
        return amount;
    });

    const lettersGain = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: synergy,
            description: "Processing Letters Experience"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(plasticBuyable.amount.value, 2).add(1),
            description: "Plastic Bins"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(paperBuyable.amount.value, 2).add(1),
            description: "Printed Labels"
        }))
    ]);
    const computedLettersGain = computed(() => lettersGain.apply(1));
    const processingCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(metalBuyable.amount.value, 2).add(1).recip(),
            description: "Sorting Machine"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.sqrt(synergy.value).recip(),
            description: "Letters Decoration",
            enabled: masteryEffectActive
        }))
    ]);
    const computedProcessingCooldown = computed(() => processingCooldown.apply(5));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Processed Letters Amount",
            modifier: lettersGain,
            base: 1
        },
        {
            title: "Processed Letters Cooldown",
            modifier: processingCooldown,
            base: 5
        }
    ]);
    const showModifiersModal = ref(false);
    const modifiersModal = jsx(() => (
        <Modal
            modelValue={showModifiersModal.value}
            onUpdate:modelValue={(value: boolean) => (showModifiersModal.value = value)}
            v-slots={{
                header: () => <h2>{name} Modifiers</h2>,
                body: generalTab
            }}
        />
    ));

    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }

        if (Decimal.gte(processingProgress.value, computedProcessingCooldown.value)) {
            processingProgress.value = computedProcessingCooldown.value;
        } else {
            processingProgress.value = Decimal.add(processingProgress.value, diff);
            if (process.isHolding.value) {
                process.onClick();
            }
        }
    });

    const { total: totalLetters, trackerDisplay } = setUpDailyProgressTracker({
        resource: letters,
        goal: 1e6,
        name,
        day,
        background: {
            gradient: "letters-bar",
            duration: "15s"
        },
        textColor: "var(--feature-foreground)",
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    const mastery = {
        letters: persistent<DecimalSource>(0),
        totalLetters: persistent<DecimalSource>(0),
        buyables: {
            metalBuyable: { amount: persistent<DecimalSource>(0) },
            plasticBuyable: { amount: persistent<DecimalSource>(0) },
            paperBuyable: { amount: persistent<DecimalSource>(0) }
        },
        milestones: {
            autoSmeltingMilestone: { earned: persistent<boolean>(false) },
            miningMilestone: { earned: persistent<boolean>(false) },
            synergyMilestone: { earned: persistent<boolean>(false) },
            industrialCrucibleMilestone: { earned: persistent<boolean>(false) }
        }
    };
    const mastered = persistent<boolean>(false);
    const masteryEffectActive = computed(
        () => mastered.value || main.currentlyMastering.value?.name === name
    );

    return {
        name,
        day,
        color,
        letters,
        totalLetters,
        processingProgress,
        processHK,
        buyables,
        milestones,
        minWidth: 700,
        generalTabCollapsed,
        collapseMilestones,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                {masteryEffectActive.value ? (
                    <>
                        <div class="decoration-effect ribbon">
                            Decoration effect:
                            <br />
                            Letter processing experience is stronger and affects processing cooldown
                            at reduced rate
                        </div>
                        <Spacer />
                    </>
                ) : null}
                <MainDisplay resource={letters} color={color} />
                {render(process)}
                {Decimal.lt(totalLetters.value, 8e9) ? (
                    <div>
                        The more letters you process, the more you'll improve at processing letters.
                        <div>Currently: {format(synergy.value)}x</div>
                    </div>
                ) : (
                    <div>You've processed all of humanity's letters to Santa!</div>
                )}
                <Spacer />
                {renderRow(...Object.values(buyables))}
                <Spacer />
                {milestonesDisplay()}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name}{" "}
                <span class="desc">
                    {format(letters.value)} {letters.displayName}
                </span>
            </div>
        )),
        mastery,
        mastered,
        masteryEffectActive
    };
});

export default layer;
