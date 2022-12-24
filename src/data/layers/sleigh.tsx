/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { createCollapsibleMilestones } from "data/common";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { jsx, showIf } from "features/feature";
import { createMilestone } from "features/milestones/milestone";
import { BaseLayer, createLayer } from "game/layers";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render } from "util/vue";
import { computed, watchEffect } from "vue";
import management from "./management";
import trees from "./trees";
import metal from "./metal";
import plastic from "./plastic";
import { createBuyable, GenericBuyable } from "features/buyable";
import { Resource } from "features/resources/resource";
import { isArray } from "@vue/shared";

const id = "sleigh";
const day = 22;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Sleigh";
    const color = "#D71830";
    const colorDark = "#A01020";
    function displayCost(
        res: Resource<DecimalSource> | Resource<DecimalSource>[],
        cost: DecimalSource,
        label: string
    ) {
        const affordable = (isArray(res) ? res : [res]).every(res => Decimal.gte(res.value, cost));
        return (
            <span class={affordable ? "" : "unaffordable"}>
                {format(cost)} {label}
            </span>
        );
    }
    const sleighProgress = computed(() => sleigh.amount);
    const sleighCost = computed(() => {
        const v = sleighProgress.value.value;
        return {
            wood: Decimal.mul(1e97, Decimal.pow(1.2, v)),
            metal: Decimal.mul(1e67, Decimal.pow(1.1, v)),
            plastic: Decimal.mul(1e22, Decimal.pow(1.05, v))
        };
    });
    const sleigh = createBuyable(() => ({
        display: jsx(() => (
            <>
                <b style="font-size: x-large">Fix 1% of the sleigh</b>
                <br />
                <br />
                <span style="font-size: large">
                    Requires: {displayCost(trees.logs, sleighCost.value.wood, "logs")},
                    {displayCost(metal.metal, sleighCost.value.metal, "metal")},
                    {displayCost(plastic.plastic, sleighCost.value.plastic, "plastic")}
                </span>
            </>
        )),
        canPurchase(): boolean {
            return (
                sleighCost.value.wood.lte(trees.logs.value) &&
                sleighCost.value.metal.lte(metal.metal.value) &&
                sleighCost.value.plastic.lte(plastic.plastic.value)
            );
        },
        onPurchase() {
            this.amount.value = Decimal.add(this.amount.value, 1);
        },
        visibility: () => showIf(Decimal.lt(sleighProgress.value.value, 100)),
        style: "width: 600px"
    })) as GenericBuyable;

    const shouldShowPopups = computed(() => true);
    const milestone1 = createMilestone(() => ({
        display: {
            requirement: "1% Sleigh Fixed",
            effectDisplay: "Ore gives 5% more metal for each % of sleigh fixed"
        },
        shouldEarn: () => Decimal.gte(sleighProgress.value.value, 1),
        showPopups: shouldShowPopups
    }));
    const milestone2 = createMilestone(() => ({
        display: {
            requirement: "10% Sleigh Fixed",
            effectDisplay: "Gain an additional 5% more wood for each 5% of sleigh fixed"
        },
        shouldEarn: () => Decimal.gte(sleighProgress.value.value, 10),
        showPopups: shouldShowPopups
    }));
    const milestone3 = createMilestone(() => ({
        display: {
            requirement: "20% Sleigh Fixed",
            effectDisplay: "Gain an additional 5% more plastic for each 5% of sleigh fixed"
        },
        shouldEarn: () => Decimal.gte(sleighProgress.value.value, 20),
        showPopups: shouldShowPopups
    }));
    const milestone4 = createMilestone(() => ({
        display: {
            requirement: "30% Sleigh Fixed",
            effectDisplay: "All automatic metal actions are doubled"
        },
        shouldEarn: () => Decimal.gte(sleighProgress.value.value, 30),
        showPopups: shouldShowPopups
    }));
    const milestone5 = createMilestone(() => ({
        display: {
            requirement: "40% Sleigh Fixed",
            effectDisplay: "Plastic gain is quadrupled"
        },
        shouldEarn: () => Decimal.gte(sleighProgress.value.value, 40),
        showPopups: shouldShowPopups
    }));
    const milestone6 = createMilestone(() => ({
        display: {
            requirement: "50% Sleigh Fixed",
            effectDisplay: "Trees give 10x as many logs"
        },
        shouldEarn: () => Decimal.gte(sleighProgress.value.value, 50),
        showPopups: shouldShowPopups
    }));
    const milestone7 = createMilestone(() => ({
        display: {
            requirement: "75% Sleigh Fixed",
            effectDisplay: "Gain 40 extra refineries for every 2% of sleigh fixed"
        },
        shouldEarn: () => Decimal.gte(sleighProgress.value.value, 75),
        showPopups: shouldShowPopups
    }));
    const milestone8 = createMilestone(() => ({
        display: {
            requirement: "100% Sleigh Fixed",
            effectDisplay: "Metal per ore is raised to the 1.2th power"
        },
        shouldEarn: () => Decimal.gte(sleighProgress.value.value, 100),
        showPopups: shouldShowPopups
    }));
    const milestones = {
        milestone1,
        milestone2,
        milestone3,
        milestone4,
        milestone5,
        milestone6,
        milestone7,
        milestone8
    };
    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(milestones);

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `animation: 15s sleigh-bar linear infinite`,
        progress: () =>
            main.day.value === day || main.currentlyMastering.value?.name === name
                ? Decimal.div(sleighProgress.value.value, 100)
                : 1,
        display: jsx(() =>
            main.day.value === day || main.currentlyMastering.value?.name === name ? (
                <>{formatWhole(sleighProgress.value.value)}%</>
            ) : (
                ""
            )
        )
    }));

    watchEffect(() => {
        if (main.day.value === day && Decimal.gte(sleighProgress.value.value, 100)) {
            main.completeDay();
        }
    });

    return {
        name,
        day,
        color,
        sleighProgress,
        milestones,
        collapseMilestones,
        minWidth: 700,
        sleigh,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day
                        ? `Fix the sleigh to complete the day`
                        : `${name} Complete!`}
                </div>
                {render(dayProgress)}
                <Spacer />
                <div>
                    <span>The sleigh is </span>
                    <h2 style={`color: ${color}; text-shadow: 0 0 10px ${color}`}>
                        {formatWhole(sleighProgress.value.value)}
                    </h2>
                    % fixed
                </div>
                {Decimal.lt(sleighProgress.value.value, 100) ||
                management.elfTraining.expandersElfTraining.milestones[2].earned.value ? (
                    <Spacer />
                ) : null}
                {render(sleigh)}
                <Spacer />
                {milestonesDisplay()}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} <span class="desc">{formatWhole(sleighProgress.value.value)}% sleigh</span>
            </div>
        ))
    };
});

export default layer;
