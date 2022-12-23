/**
 * @module
 * @hidden
 */
import HotkeyVue from "components/Hotkey.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleMilestones, createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import {
    addHardcap,
    addSoftcap,
    createIndependentConversion,
    createPolynomialScaling
} from "features/conversion";
import { jsx, showIf } from "features/feature";
import { createHotkey } from "features/hotkey";
import { createMilestone } from "features/milestones/milestone";
import { createResource, displayResource } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource, formatWhole } from "util/bignum";
import { Direction, WithRequired } from "util/common";
import { render } from "util/vue";
import { computed, ref, unref, watchEffect } from "vue";
import elves from "./elves";
import factory from "./factory";
import management from "./management";
import toys from "./toys";
import trees from "./trees";
import wrappingPaper from "./wrapping-paper";

const id = "sleigh";
const day = 22;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Sleigh";
    const color = "#D66B02";
    const colorDark = "#D66B02";

    const foundationProgress = createResource<DecimalSource>(0, "foundation progress");

    const maxFoundation = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 900,
            description: "Hope Level 3",
            enabled: management.elfTraining.expandersElfTraining.milestones[2].earned
        })),
        createAdditiveModifier(() => ({
            addend: 200,
            description: "Build wooden towers",
            enabled: toys.row1Upgrades[2].bought
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.times(factory.factoryBuyables.expandFactory.amount.value, 100),
            description: "Expand Factory",
            enabled: () => Decimal.gt(factory.factoryBuyables.expandFactory.amount.value, 0)
        }))
    ]) as WithRequired<Modifier, "revert" | "description">;
    const computedMaxFoundation = computed(() => maxFoundation.apply(100));

    const foundationConversion = createIndependentConversion(() => ({
        // note: 5423 is a magic number. Don't touch this or it'll self-destruct.
        scaling: addHardcap(
            addSoftcap(addSoftcap(createPolynomialScaling(250, 1.5), 5423, 1 / 1e10), 1e20, 3e8),
            computedMaxFoundation
        ),
        baseResource: trees.logs,
        gainResource: noPersist(foundationProgress),
        roundUpCost: true,
        // buyMax: management.elfTraining.expandersElfTraining.milestones[2].earned,
        spend(gain, spent) {
            trees.logs.value = Decimal.sub(trees.logs.value, spent);
        },
        costModifier: createSequentialModifier(() => [
            createMultiplicativeModifier(() => ({
                multiplier: wrappingPaper.boosts.beach1,
                description: "Beach Wrapping Paper",
                enabled: computed(() => Decimal.gt(wrappingPaper.boosts.beach1.value, 1))
            })),
            createExponentialModifier(() => ({
                exponent: 1 / 0.99,
                description: "Holly Level 5",
                enabled: management.elfTraining.cutterElfTraining.milestones[4].earned
            })),
            createExponentialModifier(() => ({
                exponent: 0.1,
                description: "Scaling Jump at 1000%",
                enabled: computed(() => Decimal.gte(foundationProgress.value, 1000))
            })),
            createMultiplicativeModifier(() => ({
                multiplier: 6969, // note: 6969 is a magic number. Don't touch this or it'll self-destruct.
                description: "Scaling Jump at 1000%",
                enabled: computed(() => Decimal.gte(foundationProgress.value, 1000))
            }))
        ])
    }));

    const buildFoundation = createClickable(() => ({
        display: jsx(() => (
            <>
                <b style="font-size: x-large">
                    Build {formatWhole(foundationConversion.actualGain.value)}% of the foundation{" "}
                    <HotkeyVue hotkey={buildFoundationHK} />
                </b>
                <br />
                <br />
                <span style="font-size: large">
                    {"Cost"}:{" "}
                    {displayResource(trees.logs, foundationConversion.nextAt.value)}{" "}
                    {trees.logs.displayName}
                </span>
            </>
        )),
        visibility: () => showIf(Decimal.lt(foundationProgress.value, computedMaxFoundation.value)),
        canClick: () => {
            if (Decimal.lt(trees.logs.value, foundationConversion.nextAt.value)) {
                return false;
            }
            if (Decimal.gte(foundationProgress.value, computedMaxFoundation.value)) {
                return false;
            }
            return true;
        },
        onClick() {
            if (!unref(this.canClick)) {
                return;
            }
            foundationConversion.convert();
        },
        style: "width: 600px; min-height: unset"
    }));

    const buildFoundationHK = createHotkey(() => ({
        key: "x",
        description: "Fix sleigh",
        onPress: () => {
            if (buildFoundation.canClick.value) buildFoundation.onClick();
        },
        enabled: noPersist(main.days[day - 1].opened)
    }));

    const shouldShowPopups = computed(() => !elves.milestones[6].earned.value);
    const milestone1 = createMilestone(() => ({
        display: {
            requirement: "1% Foundation Completed",
            effectDisplay: "Trees give 5% more logs for each % of foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 1),
        showPopups: shouldShowPopups
    }));
    const milestones = {
        milestone1
    };
    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(milestones);

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${colorDark}`,
        progress: () =>
            main.day.value === day || main.currentlyMastering.value?.name === name
                ? Decimal.div(foundationProgress.value, 100)
                : 1,
        display: jsx(() =>
            main.day.value === day || main.currentlyMastering.value?.name === name ? (
                <>{formatWhole(foundationProgress.value)}%</>
            ) : (
                ""
            )
        )
    }));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Max Foundation",
            modifier: maxFoundation,
            base: 100
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

    watchEffect(() => {
        if (main.day.value === day && Decimal.gte(foundationProgress.value, 100)) {
            main.completeDay();
        } else if (
            main.currentlyMastering.value?.name === name &&
            Decimal.gte(foundationProgress.value, 100)
        ) {
            main.completeMastery();
        }
    });

    return {
        name,
        day,
        color,
        foundationProgress,
        foundationConversion,
        milestones,
        collapseMilestones,
        minWidth: 700,
        buildFoundationHK,
        generalTabCollapsed,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day
                        ? `Complete the sleigh to complete the day`
                        : main.currentlyMastering.value?.name === name
                        ? `Complete the foundation to decorate the day`
                        : `${name} Complete!`}
                    {Decimal.gt(computedMaxFoundation.value, 100) ? (
                        <>
                            {" - "}
                            <button
                                class="button"
                                style="display: inline-block;"
                                onClick={() => (showModifiersModal.value = true)}
                            >
                                Check Modifiers
                            </button>
                        </>
                    ) : null}
                </div>
                {render(dayProgress)}
                {render(modifiersModal)}
                <Spacer />
                <div>
                    <span>The foundation is </span>
                    <h2 style={`color: ${color}; text-shadow: 0 0 10px ${color}`}>
                        {formatWhole(foundationProgress.value)}
                    </h2>
                    % completed
                </div>
                {Decimal.lt(foundationProgress.value, 100) ||
                management.elfTraining.expandersElfTraining.milestones[2].earned.value ? (
                    <Spacer />
                ) : null}
                {render(buildFoundation)}
                <Spacer />
                {milestonesDisplay()}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name}{" "}
                <span class="desc">
                    {formatWhole(foundationProgress.value)}% {foundationProgress.displayName}
                </span>
            </div>
        )),
    };
});

export default layer;
