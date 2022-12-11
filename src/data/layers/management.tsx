import Spacer from "components/layout/Spacer.vue";
import { createCollapsibleMilestones } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { jsx, JSXFunction, showIf } from "features/feature";
import { createMilestone, GenericMilestone } from "features/milestones/milestone";
import { createLayer } from "game/layers";
import { DefaultValue, Persistent, persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderGrid } from "util/vue";
import { computed, ComputedRef, Ref } from "vue";
import { createTabFamily } from "features/tabs/tabFamily";
import { createTab } from "features/tabs/tab";
import elves from "./elves";
import { globalBus } from "game/events";
import { createMultiplicativeModifier, createSequentialModifier, Modifier } from "game/modifiers";

const id = "management";
const day = 12;

const layer = createLayer(id, () => {
    const name = "Management";
    const color = "green"; // idk what to do

    // Day Progress
    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${color}`,
        progress: () =>
            main.day.value === day ? totalElfLevels.value / (elves.totalElves.value * 10) : 1,
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {formatWhole(totalElfLevels.value)}/{formatWhole(elves.totalElves.value * 10)}
                </>
            ) : (
                ""
            )
        )
    })) as GenericBar;

    const totalElfLevels = computed(() => {
        let elfLevel = 0;
        for (const elf of Object.values(elfTraining)) {
            elfLevel += elf.level.value;
        }
        return elfLevel;
    });
    const globalXPModifier = createSequentialModifier(() => []);
    const globalXPModifierComputed = globalXPModifier.apply(1);
    // Training core function
    function createElfTraining(
        elf: {
            name: string;
            computedAutoBuyCooldown: ComputedRef<DecimalSource>;
            amountOfTimesDone: Ref<number>;
        },
        milestones: Array<GenericMilestone>,
        ...modifiers: Modifier[]
    ) {
        const exp = persistent<DecimalSource>(0);
        const expRequiredForNextLevel = computed(() => Infinity);
        const level = computed(() => 0);
        const expToNextLevel = computed(() => 0);
        const bar = createBar(() => ({
            direction: Direction.Right,
            width: 100,
            height: 10,
            style: "margin-top: 8px",
            baseStyle: "margin-top: 0",
            fillStyle: "margin-top: 0; transition-duration: 0s",
            progress: () => Decimal.div(expToNextLevel.value, expRequiredForNextLevel.value)
        }));
        const { collapseMilestones: state, display: displayMilestone } =
            createCollapsibleMilestones(milestones as Record<number, GenericMilestone>);
        const elfXPGain = createSequentialModifier(() => [
            createMultiplicativeModifier(() => ({
                multiplier: globalXPModifierComputed,
                description: "Global XP Multiplier"
            })),
            ...modifiers
        ]);
        const elfXPGainComputed = computed(() => elfXPGain.apply(1));
        const click = createClickable(() => ({
            display: {
                title: elf.name,
                description: jsx(() => (
                    <>
                        {elf.name} is currently at level {formatWhole(level.value)}! They have{" "}
                        {format(exp.value)}/{format(exp.value)} XP. They work{" "}
                        {formatWhole(elf.computedAutoBuyCooldown.value)} times per second, gaining
                        about{" "}
                        {format(
                            Decimal.mul(elfXPGainComputed.value, elf.computedAutoBuyCooldown.value)
                        )}{" "}
                        XP/sec.{" "}
                        {currentShown.value !== elf.name
                            ? "Click to see this elf's milestones."
                            : undefined}
                        {render(bar)}
                    </>
                ))
            },
            style: "width: 190px",
            onClick() {
                currentShown.value = elf.name;
            },
            canClick() {
                return currentShown.value !== elf.name;
            },
            state,
            displayMilestone,
            level,
            exp,
            milestones,
            timeForExp: elf.computedAutoBuyCooldown,
            amountOfTimesDone: elf.amountOfTimesDone,
            elfXPGainComputed
        }));
        return click;
    }

    // Elf Milestones
    const cutterElfMilestones = [
        createMilestone(() => ({
            display: {
                requirement: "Holly Level 1",
                effectDisplay: "???"
            },
            shouldEarn: () => Decimal.gte(cutterElfTraining.level.value, 1)
        })),
        createMilestone(() => ({
            display: {
                requirement: "Holly Level 2",
                effectDisplay: "???"
            },
            visibility: showIf(cutterElfMilestones[0].earned.value),
            shouldEarn: () => Decimal.gte(cutterElfTraining.level.value, 2)
        })),
        createMilestone(() => ({
            display: {
                requirement: "Holly Level 3",
                effectDisplay: "???"
            },
            visibility: showIf(cutterElfMilestones[1].earned.value),
            shouldEarn: () => Decimal.gte(cutterElfTraining.level.value, 3)
        }))
    ] as Array<GenericMilestone>;
    const planterElfMilestones = [
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 1",
                effectDisplay: "???"
            },
            shouldEarn: () => Decimal.gte(planterElfTraining.level.value, 1)
        })),
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 2",
                effectDisplay: "???"
            },
            visibility: showIf(planterElfMilestones[0].earned.value),
            shouldEarn: () => Decimal.gte(planterElfTraining.level.value, 2)
        })),
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 3",
                effectDisplay: "???"
            },
            visibility: showIf(planterElfMilestones[1].earned.value),
            shouldEarn: () => Decimal.gte(planterElfTraining.level.value, 3)
        })),
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 4",
                effectDisplay: "???"
            },
            visibility: showIf(planterElfMilestones[2].earned.value),
            shouldEarn: () => Decimal.gte(planterElfTraining.level.value, 4)
        })),
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 5",
                effectDisplay: "???"
            },
            visibility: showIf(planterElfMilestones[3].earned.value),
            shouldEarn: () => Decimal.gte(planterElfTraining.level.value, 5)
        }))
    ] as Array<GenericMilestone>;
    const expanderElfMilestones = [
        createMilestone(() => ({
            display: {
                requirement: "Hope Level 1",
                effectDisplay: "???"
            },
            shouldEarn: () => Decimal.gte(expandersElfTraining.level.value, 3)
        }))
    ] as Array<GenericMilestone>;
    const heatedCutterElfMilestones = [] as Array<GenericMilestone>;
    const heatedPlanterElfMilestones = [] as Array<GenericMilestone>;
    const fertilizerElfMilestones = [] as Array<GenericMilestone>;
    const smallfireElfMilestones = [] as Array<GenericMilestone>;
    const bonfireElfMilestones = [] as Array<GenericMilestone>;
    const kilnElfMilestones = [] as Array<GenericMilestone>;
    const paperElfMilestones = [] as Array<GenericMilestone>;
    const boxElfMilestones = [] as Array<GenericMilestone>;
    const clothElfMilestones = [] as Array<GenericMilestone>;

    // some milestone display stuff
    const currentShown = persistent<string>("Holly");
    const currentElfDisplay = computed(() => {
        let disp: { displayMilestone: JSXFunction } = { displayMilestone: jsx(() => "") };
        switch (currentShown.value) {
            case "Holly":
                disp = cutterElfTraining;
                break;
            case "Ivy":
                disp = planterElfTraining;
                break;
            case "Hope":
                disp = expandersElfTraining;
                break;
            case "Jack":
                disp = heatedCutterElfTraining;
                break;
            case "Mary":
                disp = heatedPlanterElfTraining;
                break;
            case "Noel":
                disp = fertilizerElfTraining;
                break;
            case "Joy":
                disp = smallfireElfTraining;
                break;
            case "Faith":
                disp = bonfireElfTraining;
                break;
            case "Snowball":
                disp = kilnElfTraining;
                break;
            case "Star":
                disp = paperElfTraining;
                break;
            case "Bell":
                disp = boxElfTraining;
                break;
            case "Gingersnap":
                disp = clothElfTraining;
                break;
            default:
                console.warn("This should not happen.", currentShown.value);
                break;
        }
        return {
            name: currentShown.value,
            disp: disp.displayMilestone
        };
    });
    const cutterElfTraining = createElfTraining(elves.elves.cuttersElf, cutterElfMilestones);
    const planterElfTraining = createElfTraining(elves.elves.plantersElf, planterElfMilestones);
    const expandersElfTraining = createElfTraining(elves.elves.expandersElf, expanderElfMilestones);
    const treeElfTraining = [cutterElfTraining, planterElfTraining, expandersElfTraining];
    const heatedCutterElfTraining = createElfTraining(
        elves.elves.heatedCuttersElf,
        heatedCutterElfMilestones
    );
    const heatedPlanterElfTraining = createElfTraining(
        elves.elves.heatedPlantersElf,
        heatedPlanterElfMilestones
    );
    const fertilizerElfTraining = createElfTraining(
        elves.elves.fertilizerElf,
        fertilizerElfMilestones
    );
    const coalElfTraining = [
        heatedCutterElfTraining,
        heatedPlanterElfTraining,
        fertilizerElfTraining
    ];
    const smallfireElfTraining = createElfTraining(
        elves.elves.smallFireElf,
        smallfireElfMilestones
    );
    const bonfireElfTraining = createElfTraining(elves.elves.bonfireElf, bonfireElfMilestones);
    const kilnElfTraining = createElfTraining(elves.elves.kilnElf, kilnElfMilestones);
    const fireElfTraining = [smallfireElfTraining, bonfireElfTraining, kilnElfTraining];
    const paperElfTraining = createElfTraining(elves.elves.paperElf, paperElfMilestones);
    const boxElfTraining = createElfTraining(elves.elves.boxElf, boxElfMilestones);
    const clothElfTraining = createElfTraining(elves.elves.clothElf, clothElfMilestones);
    const plasticElfTraining = [paperElfTraining, boxElfTraining, clothElfTraining];

    const elfTraining = {
        cutterElfTraining,
        planterElfTraining,
        expandersElfTraining,
        heatedCutterElfTraining,
        heatedPlanterElfTraining,
        fertilizerElfTraining,
        smallfireElfTraining,
        bonfireElfTraining,
        kilnElfTraining,
        paperElfTraining,
        boxElfTraining,
        clothElfTraining
    };

    globalBus.on("update", () => {
        for (const elf of Object.values(elfTraining)) {
            const times = Math.floor(elf.amountOfTimesDone.value);
            if (times >= 1) {
                elf.amountOfTimesDone.value -= times;
                elf.exp.value = Decimal.mul(elf.elfXPGainComputed.value, times).add(elf.exp.value);
            }
        }
    });

    const msDisplay = jsx(() => (
        <>
            {currentElfDisplay.value.name}'s milestones: {currentElfDisplay.value.disp()}
        </>
    ));
    const tabs = createTabFamily({
        training: () => ({
            tab: createTab(() => ({
                display: jsx(() => (
                    <>
                        {renderGrid(
                            treeElfTraining,
                            coalElfTraining,
                            fireElfTraining,
                            plasticElfTraining
                        )}
                        <Spacer />
                        {msDisplay()}
                    </>
                ))
            })),
            display: "Elf Training"
        }),
        info: () => ({
            tab: createTab(() => ({
                display: jsx(() => (
                    <>
                        Each elf gains experience points (XP) every time they perform their action
                        (they don't have to buy anything though). When they get enough XP, they can
                        level up, granting special rewards.
                    </>
                ))
            })),
            display: "Info"
        })
    });
    return {
        name,
        day,
        color,
        minWidth: 700,
        elfTraining,
        currentShown,
        tabs,
        display: jsx(() => (
            <>
                {import.meta.env.DEV ? (
                    <>
                        {main.day.value === day
                            ? `Get all elves to level 10.`
                            : `${name} Complete!`}
                        {render(dayProgress)}
                        {render(tabs)}
                    </>
                ) : undefined}
            </>
        ))
    };
});

export default layer;
