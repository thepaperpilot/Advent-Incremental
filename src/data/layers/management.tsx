import { jsx, JSXFunction, showIf } from "features/feature";
import { createLayer } from "game/layers";
import { main } from "data/projEntry";
import elves from "./elves";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { createMilestone, GenericMilestone } from "features/milestones/milestone";
import { render, renderRow } from "util/vue";
import { createClickable } from "features/clickables/clickable";
import { computed } from "vue";
import { createBar, GenericBar } from "features/bars/bar";
import { Direction } from "util/common";
import { createCollapsibleMilestones } from "data/common";
import { persistent } from "game/persistence";

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
        progress: () => (main.day.value === day ? 0 : 1),
        display: jsx(() => (main.day.value === day ? <>0 / 10</> : ""))
    })) as GenericBar;

    // Training core function
    function createElfTraining(
        elf: {
            name: string;
        },
        milestones: Array<GenericMilestone>
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
        const click = createClickable(() => ({
            display: {
                title: elf.name,
                description: jsx(() => (
                    <>
                        {elf.name} is currently at level {formatWhole(level.value)}! They have{" "}
                        {format(exp.value)}/{format(exp.value)} experience points.{" "}
                        {currentShown.value !== elf.name
                            ? "Click to see this elves' milestone."
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
            milestones
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
            visible: showIf(cutterElfMilestones[0].earned.value),
            shouldEarn: () => Decimal.gte(cutterElfTraining.level.value, 2)
        })),
        createMilestone(() => ({
            display: {
                requirement: "Holly Level 3",
                effectDisplay: "???"
            },
            shouldEarn: () => Decimal.gte(cutterElfTraining.level.value, 3)
        }))
    ] as Array<GenericMilestone>;
    const planterElfMilestones = [
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 1",
                effectDisplay: "???"
            },
            shouldEarn: () => Decimal.gte(cutterElfTraining.level.value, 1)
        })),
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 2",
                effectDisplay: "???"
            },
            visible: showIf(cutterElfMilestones[0].earned.value),
            shouldEarn: () => Decimal.gte(cutterElfTraining.level.value, 2)
        })),
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 3",
                effectDisplay: "???"
            },
            shouldEarn: () => Decimal.gte(cutterElfTraining.level.value, 3)
        }))
    ] as Array<GenericMilestone>;
    const expanderElfMilestones = [] as Array<GenericMilestone>;
    const heatedCutterElfMilestones = [] as Array<GenericMilestone>;
    const heatedPlanterElfMilestones = [] as Array<GenericMilestone>;
    const fertilizerElfMilestones = [] as Array<GenericMilestone>;
    const smallfireElfMilestones = [] as Array<GenericMilestone>;
    const bonfireElfMilestones = [] as Array<GenericMilestone>;
    const kilnElfMilestones = [] as Array<GenericMilestone>;

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

    const elfTraining = {
        cutterElfTraining,
        planterElfTraining,
        expandersElfTraining,
        heatedCutterElfTraining,
        heatedPlanterElfTraining,
        fertilizerElfTraining,
        smallfireElfTraining,
        bonfireElfTraining,
        fireElfTraining
    };

    const msDisplay = jsx(() => (
        <>
            {currentElfDisplay.value.name}'s milestones: {currentElfDisplay.value.disp()}
        </>
    ));
    return {
        name,
        day,
        color,
        minWidth: 700,
        elfTraining,
        display: jsx(() => (
            <>
                {main.day.value === day ? `Get all elves to level 10.` : `${name} Complete!`}
                {render(dayProgress)}
                {renderRow(...treeElfTraining)}
                {renderRow(...coalElfTraining)}
                {renderRow(...fireElfTraining)}
                {msDisplay()}
            </>
        ))
    };
});

export default layer;
