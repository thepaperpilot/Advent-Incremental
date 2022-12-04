/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createBuyable, GenericBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { createCumulativeConversion, createPolynomialScaling } from "features/conversion";
import { jsx } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, displayResource, trackTotal } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderCol } from "util/vue";
import { computed, unref, watchEffect } from "vue";
import coal from "./coal";
import trees from "./trees";

const id = "paper";
const day = 5;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Paper";
    const color = "#E8DCB8";
    const colorDark = "#E8DCB8";

    const totalPaperGoal = 5e3;

    const paper = createResource<DecimalSource>(0, "paper");
    const totalPaper = trackTotal(paper);

    const pulp = createResource<DecimalSource>(
        computed(() =>
            Decimal.min(Decimal.div(trees.logs.value, 1e9), Decimal.div(coal.ash.value, 1e6))
        ),
        "pulp"
    );

    const paperConversion = createCumulativeConversion(() => ({
        scaling: createPolynomialScaling(1, 1.2),
        baseResource: pulp,
        gainResource: paper,
        roundUpCost: true,
        spend(gain, cost) {
            trees.logs.value = Decimal.sub(trees.logs.value, Decimal.times(cost, 1e9));
            coal.ash.value = Decimal.sub(coal.ash.value, Decimal.times(cost, 1e6));
        }
    }));

    const makePaper = createClickable(() => ({
        display: jsx(() => {
            const cost = Decimal.gte(paperConversion.actualGain.value, 1)
                ? paperConversion.currentAt.value
                : paperConversion.nextAt.value;
            return (
                <>
                    <span style="font-size: large">
                        Create {formatWhole(paperConversion.currentGain.value)} {paper.displayName}
                    </span>
                    <br />
                    <span style="font-size: large">
                        Cost: {displayResource(trees.logs, cost)} {pulp.displayName} (
                        {formatWhole(Decimal.times(cost, 1e9))} {trees.logs.displayName};{" "}
                        {formatWhole(Decimal.times(cost, 1e6))} {coal.ash.displayName})
                    </span>
                </>
            );
        }),
        canClick: () => Decimal.gte(paperConversion.actualGain.value, 1),
        onClick() {
            if (!unref(this.canClick)) {
                return;
            }
            paperConversion.convert();
        },
        style: "width: 600px; min-height: unset"
    }));

    function createBook(options: { name: string; elfName: string; buyableName: string }) {
        const buyable = createBuyable(() => ({
            display: {
                title: options.name,
                description: `Print a copy of "${options.name}", which ${options.elfName} will use to improve their skills! Each copy printed will reduce the "${options.buyableName}" price scaling by 0.95x and make ${options.elfName} purchase +10% faster!`,
                effectDisplay: jsx(() => (
                    <>
                        {format(Decimal.pow(0.95, buyable.amount.value))}x price scaling,{" "}
                        {format(Decimal.div(buyable.amount.value, 10).add(1))}x auto-purchase speed
                    </>
                )),
                showAmount: false
            },
            resource: paper,
            cost: () => Decimal.pow(5, buyable.amount.value).times(10),
            style: "width: 600px"
        })) as GenericBuyable;
        return buyable;
    }

    const cuttersBook = createBook({
        name: "Now You're Logging!",
        elfName: "Holly",
        buyableName: "Generic Cutters"
    });
    const plantersBook = createBook({
        name: "The Man Who Planted Trees",
        elfName: "Ivy",
        buyableName: "Generic Planters"
    });
    const expandersBook = createBook({
        name: "Logjam",
        elfName: "Hope",
        buyableName: "Expand Forest"
    });
    const heatedCuttersBook = createBook({
        name: "Fahrenheit 451",
        elfName: "Jack",
        buyableName: "Heated Cutters"
    });
    const heatedPlantersBook = createBook({
        name: "Tillamook Burn Country",
        elfName: "Mary",
        buyableName: "Heated Planters"
    });
    const fertilizerBook = createBook({
        name: "The Garden Tree's Handbook",
        elfName: "Noel",
        buyableName: "Fertilized Soil"
    });
    const books = {
        cuttersBook,
        plantersBook,
        expandersBook,
        heatedCuttersBook,
        heatedPlantersBook,
        fertilizerBook
    };

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${colorDark}`,
        textStyle: "color: var(--feature-foreground)",
        progress: () =>
            main.day.value === day
                ? Decimal.div(
                      Decimal.log10(Decimal.add(totalPaper.value, 1)),
                      Decimal.log10(totalPaperGoal)
                  )
                : 1,
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {formatWhole(totalPaper.value)}/{formatWhole(totalPaperGoal)}
                </>
            ) : (
                ""
            )
        )
    }));

    watchEffect(() => {
        if (main.day.value === day && Decimal.gte(totalPaper.value, totalPaperGoal)) {
            main.completeDay();
        }
    });

    return {
        name,
        day,
        color,
        paper,
        totalPaper,
        paperConversion,
        books,
        minWidth: 700,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day
                        ? `Reach ${formatWhole(totalPaperGoal)} total ${
                              paper.displayName
                          } to complete the day`
                        : `${name} Complete!`}
                </div>
                {render(dayProgress)}
                <Spacer />
                <MainDisplay resource={paper} color={color} style="margin-bottom: 0" />
                <Spacer />
                {render(makePaper)}
                <Spacer />
                {renderCol(...Object.values(books))}
            </>
        ))
    };
});

export default layer;
