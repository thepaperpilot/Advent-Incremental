import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleMilestones, createCollapsibleModifierSections } from "data/common";
import { createBar, GenericBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { globalBus } from "game/events";
import { createLayer, layers } from "game/layers";
import { createSequentialModifier } from "game/modifiers";
import { persistent } from "game/persistence";
import player from "game/player";
import { DecimalSource } from "lib/break_eternity";
import Decimal, { format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render } from "util/vue";
import { computed, ref, unref, watchEffect } from "vue";
import { main } from "../projEntry";
import cloth from "./cloth";
import dyes from "./dyes";
import elves from "./elves";

const id = "ribbon";
const day = 16;

const layer = createLayer(id, () => {
    const name = "Ribbon";
    const color = "darkred";

    const ribbon = createResource<DecimalSource>(0, "Ribbon");

    const currentDyeCost = computed(() =>
        Decimal.times(
            ribbon.value,
            [dyes.dyes.orange, dyes.dyes.green, dyes.dyes.purple].includes(currentDyeType.value)
                ? 2e6
                : 1e13
        )
    );
    const currentDyeType = computed(
        () => Object.values(dyes.dyes)[new Decimal(ribbon.value).toNumber() % 6]
    );

    const ribbonProgress = persistent<DecimalSource>(0);
    const ribbonProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        borderStyle: "border-color: black",
        baseStyle: "margin-top: -1px",
        fillStyle: "margin-top: -1px; transition-duration: 0s; background: black",
        progress: () => Decimal.div(ribbonProgress.value, computedRibbonCooldown.value)
    }));
    const makeRibbon = createClickable(() => ({
        display: {
            title: "Make Ribbon",
            description: jsx(() => (
                <>
                    Create another ribbon with {format(currentDyeCost.value)}{" "}
                    {currentDyeType.value.name} and {format(1e9)} {cloth.cloth.displayName}
                    <br />
                    {render(ribbonProgressBar)}
                </>
            ))
        },
        style: {
            minHeight: "80px"
        },
        canClick: () =>
            Decimal.gte(ribbonProgress.value, computedRibbonCooldown.value) &&
            Decimal.gte(currentDyeType.value.amount.value, currentDyeCost.value) &&
            Decimal.gte(cloth.cloth.value, 1e9),
        onClick() {
            if (!unref(makeRibbon.canClick)) {
                return;
            }
            currentDyeType.value.amount.value = 0;
            currentDyeType.value.buyable.amount.value = 0;
            cloth.cloth.value = Decimal.sub(cloth.cloth.value, 1e9);
            ribbon.value = Decimal.add(ribbon.value, 1);
            ribbonProgress.value = 0;
        }
    }));

    const ribbonCooldown = createSequentialModifier(() => []);
    const computedRibbonCooldown = computed(() => ribbonCooldown.apply(10));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Ribbon Cooldown",
            modifier: ribbonCooldown,
            base: 10
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

    const secondaryDyeElf = createMilestone(() => ({
        display: {
            requirement: "5 Ribbons",
            effectDisplay: "Carol will now mix secondary dyes for you"
        },
        shouldEarn: () => Decimal.gte(ribbon.value, 5)
    }));
    const dyeBook = createMilestone(() => ({
        display: {
            requirement: "10 Ribbons",
            effectDisplay: "Unlock a new book"
        },
        shouldEarn: () => Decimal.gte(ribbon.value, 10),
        visibility: () => showIf(secondaryDyeElf.earned.value)
    }));
    const milestones = { secondaryDyeElf, dyeBook };
    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(milestones);

    const masteryReq = computed(() =>
        Decimal.sub(masteredDays.value, 5).times(Decimal.sub(masteredDays.value, 4).div(2))
    );
    const enterMasteryButton = createClickable(() => ({
        display: () => ({
            title: `${main.isMastery.value ? "Stop Decorating" : "Begin Decorating"} ${
                Object.values(layers).find(
                    layer =>
                        unref((layer as any).mastered) === false &&
                        !["Elves", "Management"].includes(unref(layer?.name ?? ""))
                )?.name
            }`,
            description: jsx(() => {
                return (
                    <>
                        <br />
                        Decorating brings you to a separate version of each day that only allows
                        layers that are decorated or being decorated to work. These days will have a
                        new decoration effect that applies outside of decorating as well.
                        <br />
                        You can safely start and stop decorating without losing progress
                        {main.isMastery.value ? null : (
                            <>
                                <br />
                                <br />
                                Requires {formatWhole(masteryReq.value)} total ribbons
                            </>
                        )}
                    </>
                );
            })
        }),
        visibility: () => showIf(main.day.value === day),
        canClick() {
            return main.isMastery.value || Decimal.gte(ribbon.value, masteryReq.value);
        },
        onClick() {
            if (!unref(enterMasteryButton.canClick)) {
                return;
            }
            main.toggleMastery();
            const layer = main.currentlyMastering.value?.id ?? "trees";
            if (!player.tabs.includes(layer)) {
                main.openDay(layer);
            }
            if (layer === "paper") {
                // Purchase first 6 elves
                elves.elves.cuttersElf.bought.value = true;
                elves.elves.plantersElf.bought.value = true;
                elves.elves.expandersElf.bought.value = true;
                elves.elves.heatedCuttersElf.bought.value = true;
                elves.elves.heatedPlantersElf.bought.value = true;
                elves.elves.fertilizerElf.bought.value = true;
            }
        },
        style: {
            width: "300px",
            minHeight: "160px"
        }
    }));

    const masteredDays = computed(() =>
        Object.values(layers)
            .filter(l => l && "mastered" in l)
            .findIndex(l => (l as any).mastered.value === false)
    );

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${color}`,
        progress: () => (main.day.value === day ? Decimal.div(masteredDays.value - 6, 5) : 1),
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {masteredDays.value - 6}
                    /5 days decorated
                </>
            ) : (
                ""
            )
        )
    })) as GenericBar;

    watchEffect(() => {
        if (
            main.day.value === day &&
            Decimal.gte(masteredDays.value, 11) &&
            main.showLoreModal.value === false
        ) {
            main.completeDay();
        }
    });

    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }

        if (Decimal.gte(ribbonProgress.value, computedRibbonCooldown.value)) {
            ribbonProgress.value = computedRibbonCooldown.value;
        } else {
            ribbonProgress.value = Decimal.add(ribbonProgress.value, diff);
            if (makeRibbon.isHolding.value) {
                makeRibbon.onClick();
            }
        }
    });

    return {
        name,
        day,
        color,
        ribbon,
        ribbonProgress,
        milestones,
        collapseMilestones,
        generalTabCollapsed,
        display: jsx(() => {
            return (
                <div style="width: 620px">
                    <div>
                        {main.day.value === day
                            ? `Decorate 5 previous days to complete the day`
                            : `${name} Complete!`}{" "}
                        -{" "}
                        <button
                            class="button"
                            style="display: inline-block;"
                            onClick={() => (showModifiersModal.value = true)}
                        >
                            Check Modifiers
                        </button>
                    </div>
                    {render(dayProgress)}
                    {render(modifiersModal)}
                    <Spacer />
                    <MainDisplay resource={ribbon} color={color} />
                    {render(makeRibbon)}
                    <Spacer />
                    {render(enterMasteryButton)}
                    <Spacer />
                    {render(milestonesDisplay)}
                </div>
            );
        }),
        minWidth: 700
    };
});

export default layer;
