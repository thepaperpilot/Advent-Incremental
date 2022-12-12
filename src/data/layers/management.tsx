import Spacer from "components/layout/Spacer.vue";
import Sqrt from "components/math/Sqrt.vue";
import { createCollapsibleMilestones, createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { jsx, JSXFunction, showIf } from "features/feature";
import { createMilestone, GenericMilestone } from "features/milestones/milestone";
import { createLayer } from "game/layers";
import { persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderGrid } from "util/vue";
import { computed, ComputedRef, ref, Ref } from "vue";
import { createTabFamily } from "features/tabs/tabFamily";
import { createTab } from "features/tabs/tab";
import elves from "./elves";
import trees from "./trees";
import { globalBus } from "game/events";
import { createMultiplicativeModifier, createSequentialModifier, Modifier } from "game/modifiers";
import Modal from "components/Modal.vue";
import { createBuyable } from "features/buyable";
import { createUpgrade } from "features/upgrades/upgrade";
import coal from "./coal";
import paper from "./paper";
import boxes from "./boxes";
import metal from "./metal";
import cloth from "./cloth";
import plastic from "./plastic";
import dyes from "./dyes";

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
            main.day.value === day ? totalElfLevels.value / (elves.totalElves.value * 5) : 1,
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {formatWhole(totalElfLevels.value)}/{formatWhole(elves.totalElves.value * 5)}{" "}
                    elf levels
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
    const teaching = createUpgrade(() => ({
        display: {
            title: "Teach the Elves",
            description:
                "The Elves probably need to be taught if they're to do better. Maybe you'll build a school so you can teach them?"
        },
        resource: trees.logs,
        cost: 1e21
    }));

    const classroomUpgrade = createUpgrade(() => ({
        display: {
            title: "Add a Classroom?",
            description:
                "Yay, you have a school. Too bad it has pretty much nothing in it. Maybe you could add some classrooms to make it less boring and more enticing to the Elves?"
        },
        resource: boxes.boxes,
        style: "width: 150px",
        cost: 1e13
    }));
    const globalXPModifier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => classroomEffect.value,
            description: "Classroom Effect",
            enabled: () => classroomUpgrade.bought.value
        }))
    ]);
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
        const expRequiredForNextLevel = computed(() => Decimal.pow(10, level.value).mul(1e4));
        const level = computed(() =>
            Decimal.min(Decimal.mul(9, exp.value).div(1e4).add(1).log10().floor(), schools.amount.value).toNumber()
        );
        const expToNextLevel = computed(() =>
            Decimal.sub(exp.value, Decimal.pow(10, level.value).sub(1).div(9).mul(1e4))
        );
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
                        {elf.name} is currently at level {formatWhole(level.value)}! They have
                        achieved a total of {format(exp.value)} XP, and have{" "}
                        {format(expToNextLevel.value)}/{format(expRequiredForNextLevel.value)} XP.
                        They buy buyables {formatWhole(elf.computedAutoBuyCooldown.value)} times per
                        second, gaining{" "}
                        {Decimal.gte(level.value, schools.amount.value)
                            ? 0
                            : format(
                                  Decimal.mul(
                                      elfXPGainComputed.value,
                                      elf.computedAutoBuyCooldown.value
                                  )
                              )}{" "}
                        XP/sec.{" "}
                        {Decimal.gte(level.value, schools.amount.value) ? (
                            <div style="color: red">
                                This elf cannot gain any XP because it has exceeded the maximum
                                level from schools.
                            </div>
                        ) : undefined}
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
            elfXPGainComputed,
            elfXPGain
        }));
        return click;
    }

    // Elf Milestones
    const cutterElfMilestones = [
        createMilestone(() => ({
            display: () => ({
                requirement: "Holly Level 1",
                effectDisplay: "Cutting speed multiplies log gain."
            }),
            shouldEarn: () => cutterElfTraining.level.value >= 1
        })),
        createMilestone(() => ({
            display: {
                requirement: "Holly Level 2",
                effectDisplay: "Holly now buys max."
            },
            visibility: () => showIf(cutterElfMilestones[0].earned.value),
            shouldEarn: () => cutterElfTraining.level.value >= 2
        })),
        createMilestone(() => ({
            display: {
                requirement: "Holly Level 3",
                effectDisplay:
                    "Cutting speed multiplies cloth gain, wool gain (increasing the requirement as well), and sheep gain."
            },
            visibility: () => showIf(cutterElfMilestones[1].earned.value),
            shouldEarn: () => cutterElfTraining.level.value >= 3
        }))
    ] as Array<GenericMilestone>;
    const planterElfMilestones = [
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 1",
                effectDisplay: "Planters are now twice as efficent."
            },
            shouldEarn: () => planterElfTraining.level.value >= 1
        })),
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 2",
                effectDisplay: "Ivy now buys max."
            },
            visibility: () => showIf(planterElfMilestones[0].earned.value),
            shouldEarn: () => planterElfTraining.level.value >= 2
        })),
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 3",
                effectDisplay: "???"
            },
            visibility: () => showIf(planterElfMilestones[1].earned.value),
            shouldEarn: () => planterElfTraining.level.value >= 3
        })),
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 4",
                effectDisplay: "???"
            },
            visibility: () => showIf(planterElfMilestones[2].earned.value),
            shouldEarn: () => planterElfTraining.level.value >= 4
        })),
        createMilestone(() => ({
            display: {
                requirement: "Ivy Level 5",
                effectDisplay: "???"
            },
            visibility: () => showIf(planterElfMilestones[3].earned.value),
            shouldEarn: () => planterElfTraining.level.value >= 5
        }))
    ] as Array<GenericMilestone>;
    const expanderElfMilestones = [
        createMilestone(() => ({
            display: {
                requirement: "Hope Level 1",
                effectDisplay: "???"
            },
            shouldEarn: () => expandersElfTraining.level.value >= 1
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
        if (main.day.value < day) return;
        for (const elf of Object.values(elfTraining)) {
            const times = Math.floor(elf.amountOfTimesDone.value);
            if (times >= 1) {
                elf.amountOfTimesDone.value -= times;
                if (Decimal.lt(elf.level.value, schools.amount.value))
                    elf.exp.value = Decimal.mul(elf.elfXPGainComputed.value, times).add(
                        elf.exp.value
                    );
            }
        }
    });

    const msDisplay = jsx(() => (
        <>
            {currentElfDisplay.value.name}'s milestones: {currentElfDisplay.value.disp()}
        </>
    ));

    const schoolCost = computed(() => {
        const schoolFactor = Decimal.pow(10, schools.amount.value);
        return {
            wood: schoolFactor.mul(1e21),
            coal: schoolFactor.mul(1e32),
            paper: schoolFactor.mul(1e19),
            boxes: schoolFactor.mul(1e13),
            metalIngots: schoolFactor.mul(1e12),
            cloth: schoolFactor.mul(1e4),
            plastic: schoolFactor.mul(1e6),
            dye: Decimal.add(schools.amount.value, 1).mul(10000)
        };
    });

    const schools = createBuyable(() => ({
        display: jsx(() => (
            <>
                <h3>Build a School</h3>
                <div>
                    You gotta start somewhere, right? Each school increases the maximum level for
                    elves by 1. Maximum of 5.
                </div>
                <div>You have {formatWhole(schools.amount.value)} schools.</div>
                <div>
                    They are currently letting elves learn up to level{" "}
                    {formatWhole(schools.amount.value)}.
                </div>
                <div>
                    Costs {format(schoolCost.value.wood)} logs, {format(schoolCost.value.coal)}{" "}
                    coal, {format(schoolCost.value.paper)} paper, {format(schoolCost.value.boxes)}{" "}
                    boxes, {format(schoolCost.value.metalIngots)} metal ingots,{" "}
                    {format(schoolCost.value.cloth)} cloth, {format(schoolCost.value.plastic)}{" "}
                    plastic, and requires {format(schoolCost.value.dye)} of red, yellow, and blue
                    dye
                </div>
            </>
        )),
        canPurchase(): boolean {
            return (
                schoolCost.value.wood.lte(trees.logs.value) &&
                schoolCost.value.coal.lte(coal.coal.value) &&
                schoolCost.value.paper.lte(paper.paper.value) &&
                schoolCost.value.boxes.lte(boxes.boxes.value) &&
                schoolCost.value.metalIngots.lte(metal.metal.value) &&
                schoolCost.value.cloth.lte(cloth.cloth.value) &&
                schoolCost.value.plastic.lte(plastic.plastic.value) &&
                schoolCost.value.dye.lte(dyes.dyes.blue.amount.value) &&
                schoolCost.value.dye.lte(dyes.dyes.red.amount.value) &&
                schoolCost.value.dye.lte(dyes.dyes.yellow.amount.value)
            );
        },
        onPurchase() {
            trees.logs.value = Decimal.sub(trees.logs.value, schoolCost.value.wood);
            coal.coal.value = Decimal.sub(coal.coal.value, schoolCost.value.coal);
            paper.paper.value = Decimal.sub(paper.paper.value, schoolCost.value.paper);
            boxes.boxes.value = Decimal.sub(boxes.boxes.value, schoolCost.value.boxes);
            metal.metal.value = Decimal.sub(metal.metal.value, schoolCost.value.metalIngots);
            cloth.cloth.value = Decimal.sub(cloth.cloth.value, schoolCost.value.cloth);
            plastic.plastic.value = Decimal.sub(plastic.plastic.value, schoolCost.value.plastic);
            this.amount.value = Decimal.add(this.amount.value, 1);
        },
        purchaseLimit: 5,
        visibility: computed(() => showIf(teaching.bought.value)),
        style: "width: 600px"
    }));

    const classroomCost = computed(() => {
        const classroomFactor = Decimal.add(schools.amount.value, 1).pow(1.5);
        return {
            wood: classroomFactor.mul(1e21),
            coal: classroomFactor.mul(1e32),
            paper: classroomFactor.mul(1e19),
            boxes: classroomFactor.mul(1e13),
            metalIngots: classroomFactor.mul(1e12),
            cloth: classroomFactor.mul(1e4),
            plastic: classroomFactor.mul(1e6),
            dye: classroomFactor.mul(10000)
        };
    });

    const classroomEffect = computed(() => {
        return Decimal.add(classrooms.amount.value, 1).sqrt();
    });

    const classrooms = createBuyable(() => ({
        display: jsx(() => (
            <>
                <h3>Build a Classroom</h3>
                <div>
                    Hopefully it makes the school a bit less boring. Multiplies elves' XP gain by{" "}
                    <Sqrt>Classrooms + 1</Sqrt>.
                </div>
                <div>You have {formatWhole(schools.amount.value)} classrooms.</div>
                <div>
                    They are currently multiplying elves' XP gain by {format(classroomEffect.value)}
                </div>
                <div>
                    Costs {format(classroomCost.value.wood)} logs,{" "}
                    {format(classroomCost.value.coal)} coal, {format(classroomCost.value.paper)}{" "}
                    paper, {format(classroomCost.value.boxes)} boxes,{" "}
                    {format(classroomCost.value.metalIngots)} metal ingots,{" "}
                    {format(classroomCost.value.cloth)} cloth, {format(classroomCost.value.plastic)}{" "}
                    plastic, and requires {format(classroomCost.value.dye)} of red, yellow, and blue
                    dye
                </div>
            </>
        )),
        canPurchase(): boolean {
            return (
                classroomCost.value.wood.lte(trees.logs.value) &&
                classroomCost.value.coal.lte(coal.coal.value) &&
                classroomCost.value.paper.lte(paper.paper.value) &&
                classroomCost.value.boxes.lte(boxes.boxes.value) &&
                classroomCost.value.metalIngots.lte(metal.metal.value) &&
                classroomCost.value.cloth.lte(cloth.cloth.value) &&
                classroomCost.value.plastic.lte(plastic.plastic.value) &&
                classroomCost.value.dye.lte(dyes.dyes.blue.amount.value) &&
                classroomCost.value.dye.lte(dyes.dyes.red.amount.value) &&
                classroomCost.value.dye.lte(dyes.dyes.yellow.amount.value)
            );
        },
        onPurchase() {
            trees.logs.value = Decimal.sub(trees.logs.value, classroomCost.value.wood);
            coal.coal.value = Decimal.sub(coal.coal.value, classroomCost.value.coal);
            paper.paper.value = Decimal.sub(paper.paper.value, classroomCost.value.paper);
            boxes.boxes.value = Decimal.sub(boxes.boxes.value, classroomCost.value.boxes);
            metal.metal.value = Decimal.sub(metal.metal.value, classroomCost.value.metalIngots);
            cloth.cloth.value = Decimal.sub(cloth.cloth.value, classroomCost.value.cloth);
            plastic.plastic.value = Decimal.sub(plastic.plastic.value, classroomCost.value.plastic);
            this.amount.value = Decimal.add(this.amount.value, 1);
        },
        visibility: computed(() => showIf(classroomUpgrade.bought.value)),
        style: "width: 600px"
    }));

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
        teaching: () => ({
            tab: createTab(() => ({
                display: jsx(() => (
                    <>
                        {render(schools)} {render(classrooms)}{" "}
                        {renderGrid([teaching, classroomUpgrade])}
                    </>
                ))
            })),
            display: "The Schools"
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

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Global XP Gain",
            modifier: globalXPModifier,
            unit: " XP"
        },
        {
            title: "Holly XP Gain per Action",
            modifier: cutterElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Ivy XP Gain per Action",
            modifier: planterElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Hope XP Gain per Action",
            modifier: expandersElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Jack XP Gain per Action",
            modifier: heatedCutterElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Mary XP Gain per Action",
            modifier: heatedPlanterElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Noel XP Gain per Action",
            modifier: fertilizerElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Joy XP Gain per Action",
            modifier: smallfireElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Faith XP Gain per Action",
            modifier: bonfireElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Snowball XP Gain per Action",
            modifier: kilnElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Star XP Gain per Action",
            modifier: paperElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Bell XP Gain per Action",
            modifier: boxElfTraining.elfXPGain,
            unit: " XP"
        },
        {
            title: "Gingersnap XP Gain per Action",
            modifier: clothElfTraining.elfXPGain,
            unit: " XP"
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
    return {
        name,
        day,
        color,
        minWidth: 700,
        elfTraining,
        currentShown,
        tabs,
        generalTabCollapsed,
        teaching,
        schools,
        classrooms,
        classroomUpgrade,
        display: jsx(() => (
            <>
                        {main.day.value === day ? `Get all elves to level 5.` : `${name} Complete!`}{" "}
                        -
                        <button
                            class="button"
                            style="display: inline-block;"
                            onClick={() => (showModifiersModal.value = true)}
                        >
                            Check Modifiers
                        </button>
                        {render(modifiersModal)}
                        {render(dayProgress)}
                        {render(tabs)}
            </>
        ))
    };
});

export default layer;
