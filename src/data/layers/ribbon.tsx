import Spacer from "components/layout/Spacer.vue";
import { createBar, GenericBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createMilestone } from "features/milestones/milestone";
import { createResource } from "features/resources/resource";
import { createLayer, layers } from "game/layers";
import player from "game/player";
import { DecimalSource } from "lib/break_eternity";
import Decimal, { formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render } from "util/vue";
import { computed, unref, watchEffect } from "vue";
import { main } from "../projEntry";
import elves from "./elves";

const id = "ribbon";
const day = 16;

const layer = createLayer(id, () => {
    const name = "Ribbon";
    const color = "darkred";

    const ribbon = createResource<DecimalSource>(0, "Ribbon");

    const milestones = {
        secondaryDyeElf: createMilestone(() => ({
            display: {
                requirement: "10 Ribbons",
                effectDisplay: "Carol will now mix secondary dyes for you"
            },
            shouldEarn: () => Decimal.gte(ribbon.value, 10)
        })),
        dyeBook: createMilestone(() => ({
            display: {
                requirement: "20 Ribbons",
                effectDisplay: "Unlock a new book"
            },
            shouldEarn: () => Decimal.gte(ribbon.value, 20)
        }))
    }

    const masteryReq = computed(() => Decimal.pow(2, masteredDays.value).times(30));
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
                                Requires {formatWhole(masteryReq.value)} total wrapping paper
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
        textStyle: `color: var(--feature-foreground)`,
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

    return {
        name,
        day,
        color,
        ribbon,
        milestones,
        display: jsx(() => {
            return (
                <div style="width: 620px">
                    <div>
                        {main.day.value === day
                            ? `Decorate 5 previous days to complete the day`
                            : `${name} Complete!`}
                    </div>
                    {render(dayProgress)}
                    <Spacer />
                    {render(enterMasteryButton)}
                </div>
            );
        }),
        minWidth: 700
    };
});

export default layer;
