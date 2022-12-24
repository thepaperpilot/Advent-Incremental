/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleMilestones, createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { BoardNode, BoardNodeLink, createBoard, Shape } from "features/boards/board";
import { createBuyable, GenericBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createMilestone, GenericMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { DefaultValue, persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction, WithRequired } from "util/common";
import { render, renderRow } from "util/vue";
import { computed, ComputedRef, ref, unref, watchEffect } from "vue";
import factory from "./factory";
import management from "./management";
import metal from "./metal";
import "./styles/routing.css";
import Fraction from "components/math/Fraction.vue";

const alpha = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z"
];

const id = "routing";
const day = 23;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Routing";
    const color = "navajowhite";

    const citiesGoal = 5000000;

    const citiesCompleted = createResource<DecimalSource>(0, "cities solved");
    const currentCity = persistent<number[][]>([]);
    const routeIndex = persistent<number>(0);
    const checkRouteProgress = persistent<number>(0);
    const redundanciesRemoved = persistent<number>(0);

    const currentRoutes = computed(() => {
        // Manually check milestone req here due to calling generateCity() before milestones get earned
        if (Decimal.gte(citiesCompleted.value, 7) || currentCity.value.length >= 12) {
            return Decimal.factorial(currentCity.value.length).div(2).toNumber();
        }
        // Permutation code from https://stackoverflow.com/a/37580979
        const length = currentCity.value.length;
        const permutation = new Array(length).fill(0).map((_, i) => i);
        const result = [permutation.slice()];
        const c = new Array(length).fill(0);
        let i = 1;

        while (i < length) {
            if (c[i] < i) {
                const k = i % 2 && c[i];
                const p = permutation[i];
                permutation[i] = permutation[k];
                permutation[k] = p;
                ++c[i];
                i = 1;
                result.push(permutation.slice());
            } else {
                c[i] = 0;
                ++i;
            }
        }
        return result;
    });
    const redundantRoutes = computed(() => {
        const routes = currentRoutes.value;
        if (typeof routes === "number") {
            return [];
        }
        const redundancies = [];
        for (let i = 0; i < routes.length; i++) {
            if (routes[i][0] > routes[i][1]) {
                redundancies.push(i);
            }
        }
        return redundancies;
    });
    const routesToSkip = persistent<number[]>([]);

    const currentRoute: ComputedRef<number[] | number | undefined> = computed(() =>
        typeof currentRoutes.value === "number"
            ? currentCity.value.length
            : currentRoutes.value[routeIndex.value]
    );

    const currentRouteDuration = computed(() => {
        const route = currentRoute.value;
        if (route == null) {
            return 0;
        } else if (typeof route === "number") {
            return Decimal.times(route, computedMinWeight.value).floor().toNumber();
        }
        let duration = 0;
        for (let i = 0; i < route.length - 1; i++) {
            duration += currentCity.value[route[i]][route[i + 1]];
        }
        return duration;
    });

    globalBus.on("onLoad", () => {
        if (currentCity.value.length === 0) {
            generateCity();
        }
    });

    function stringifyRoute(route: number[]) {
        return route
            .map(h => (city.types.house.title as (node: BoardNode) => string)(city.nodes.value[h]))
            .join(" > ");
    }

    function generateCity() {
        if (Decimal.lte(citiesCompleted.value, 50)) {
            const numHouses = new Decimal(computedHouses.value).clampMin(3).toNumber();
            const min = computedMinWeight.value;
            const max = milestone6.earned.value ? min : computedMaxWeight.value;
            const diff = Decimal.sub(max, min);
            const city: number[][] = [];
            for (let i = 0; i < numHouses; i++) {
                const house: number[] = [];
                for (let j = 0; j < numHouses; j++) {
                    if (i === j) {
                        house.push(0);
                    } else if (j < i) {
                        house.push(city[j][i]);
                    } else {
                        house.push(Decimal.times(diff, Math.random()).add(min).floor().toNumber());
                    }
                }
                city.push(house);
            }
            currentCity.value = city;
            routeIndex.value = 0;
            redundanciesRemoved.value = Decimal.gte(citiesCompleted.value, 7)
                ? Decimal.factorial(currentCity.value.length).div(2).toNumber()
                : 0;
            routesToSkip.value = [];
            getNextRoute();
        }
    }

    function getNextRoute() {
        const numRoutes =
            typeof currentRoutes.value === "number"
                ? currentRoutes.value
                : currentRoutes.value.length;
        while (routeIndex.value <= numRoutes && routesToSkip.value.includes(routeIndex.value)) {
            routeIndex.value++;
        }
        if (routeIndex.value >= numRoutes) {
            citiesCompleted.value = Decimal.add(citiesCompleted.value, 1);
            generateCity();
        } else {
            if (redundantRoutes.value.includes(routeIndex.value)) {
                routesToSkip.value = [...routesToSkip.value, routeIndex.value];
            }
            checkRouteProgress.value = 0;
        }
    }

    const newCityProgress = persistent<DecimalSource>(0);
    const newCityProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        borderStyle: "border-color: black",
        baseStyle: "margin-top: -1px",
        fillStyle: "margin-top: -1px; transition-duration: 0s; background: black",
        progress: () => Decimal.div(newCityProgress.value, 10)
    }));
    const getNewCity = createClickable(() => ({
        display: {
            description: jsx(() => (
                <>
                    Generate New City
                    <br />
                    {render(newCityProgressBar)}
                </>
            ))
        },
        style: {
            minHeight: "40px",
            "--layer-color": "var(--danger)"
        },
        canClick: () => Decimal.gte(newCityProgress.value, 10),
        onClick() {
            if (!unref(getNewCity.canClick)) {
                return;
            }
            generateCity();
            newCityProgress.value = 0;
        }
    }));

    const boostProgress = persistent<DecimalSource>(0);
    const boostProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        borderStyle: "border-color: black",
        baseStyle: "margin-top: -1px",
        fillStyle: "margin-top: -1px; transition-duration: 0s; background: black",
        progress: () => Decimal.div(boostProgress.value, computedManualCooldown.value)
    }));
    const boost = createClickable(() => ({
        display: {
            description: jsx(() => (
                <>
                    Perform {formatWhole(computedManualBoost.value)} units of work
                    <br />
                    {render(boostProgressBar)}
                </>
            ))
        },
        style: {
            minHeight: "40px"
        },
        canClick: () => Decimal.gte(boostProgress.value, computedManualCooldown.value),
        onClick() {
            if (!unref(boost.canClick)) {
                return;
            }
            checkRouteProgress.value = Decimal.add(
                checkRouteProgress.value,
                computedManualBoost.value
            ).toNumber();
            boostProgress.value = 0;
        }
    }));

    const redundantProgress = persistent<DecimalSource>(0);
    const redundantProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        borderStyle: "border-color: black",
        baseStyle: "margin-top: -1px",
        fillStyle: "margin-top: -1px; transition-duration: 0s; background: black",
        progress: () => Decimal.div(redundantProgress.value, computedRedundantCooldown.value)
    }));
    const removeRedundantRoute = createClickable(() => ({
        display: {
            description: jsx(() => (
                <>
                    Remove a redundant route from the list to check
                    <br />
                    {render(redundantProgressBar)}
                </>
            ))
        },
        style: {
            minHeight: "40px"
        },
        visibility: () => showIf(!milestone7.earned.value),
        canClick: () =>
            Decimal.gte(redundantProgress.value, computedRedundantCooldown.value) &&
            routesToSkip.value.length < redundantRoutes.value.length,
        onClick() {
            if (!unref(removeRedundantRoute.canClick)) {
                return;
            }
            routesToSkip.value = [
                ...routesToSkip.value,
                redundantRoutes.value[routesToSkip.value.length]
            ];
            redundantProgress.value = 0;
            redundanciesRemoved.value++;
        }
    }));

    const city = createBoard(() => ({
        startNodes: () => [],
        types: {
            house: {
                shape: Shape.Circle,
                fillColor: "var(--highlighted)",
                outlineColor: "var(--accent1)",
                size: 20,
                title(node) {
                    let letter = node.state as number;
                    let name = "";
                    while (true) {
                        if (letter < 26) {
                            name += alpha[letter];
                            break;
                        }
                        let thisLetter = letter;
                        let iterations = 0;
                        while (Math.floor(thisLetter / 26) - 1 >= 0) {
                            thisLetter = Math.floor(thisLetter / 26) - 1;
                            iterations++;
                        }
                        name += alpha[thisLetter];

                        let amountToDecrement = thisLetter + 1;
                        for (let i = 0; i < iterations; i++) {
                            amountToDecrement *= 26;
                        }
                        letter -= amountToDecrement;
                    }
                    return name;
                }
            }
        },
        width: "600px",
        height: "600px",
        state: computed(() => {
            if (Decimal.gte(citiesCompleted.value, 50))
                return {
                    nodes: [],
                    selectedNode: null,
                    selectedAction: null
                };
            const nodes: BoardNode[] = [];
            const city = currentCity.value;
            const rows = Math.ceil(Math.sqrt(city.length));
            const cols = Math.ceil(city.length / rows);
            for (let i = 0; i < city.length; i++) {
                const row = Math.floor(i / rows);
                const col = Math.floor(i % rows);
                const randomOffsetIndex = i + new Decimal(citiesCompleted.value).toNumber();
                nodes.push({
                    id: i,
                    position: {
                        x: 160 * (-(cols - 1) / 2 + col) + Math.cos(randomOffsetIndex) * 40,
                        y: 160 * (-(rows - 1) / 2 + row) + Math.sin(randomOffsetIndex) * 40
                    },
                    type: "house",
                    state: i
                });
            }
            return {
                nodes,
                selectedNode: null,
                selectedAction: null
            };
        }),
        links() {
            if (Decimal.gte(citiesCompleted.value, 15)) return [];
            const links: BoardNodeLink[] = [];
            const route = currentRoute.value;
            if (route == null) {
                return links;
            }
            const citySize = currentCity.value.length;
            let completedLegs = 0;
            let progress = 0;
            let partialLeg = 0;
            if (typeof route !== "number") {
                for (let i = 0; i < route.length - 1; i++) {
                    const weight = progress + currentCity.value[route[i]][route[i + 1]];
                    if (checkRouteProgress.value > weight) {
                        completedLegs++;
                        progress = weight;
                    } else {
                        break;
                    }
                }
                partialLeg =
                    (checkRouteProgress.value - progress) /
                    currentCity.value[route[completedLegs]][route[completedLegs + 1]];
            }
            for (let i = 0; i < citySize; i++) {
                for (let j = 0; j < citySize; j++) {
                    if (i !== j) {
                        let progress = 0;
                        if (typeof route !== "number") {
                            const iIndex = route.indexOf(i);
                            const jIndex = route.indexOf(j);
                            if (
                                iIndex >= 0 &&
                                jIndex >= 0 &&
                                (route[iIndex + 1] === j || route[jIndex + 1] === i)
                            ) {
                                if (jIndex < completedLegs || iIndex < completedLegs) {
                                    progress = 1;
                                } else if (jIndex === completedLegs || iIndex === completedLegs) {
                                    progress = partialLeg;
                                }
                            }
                        }
                        links.push({
                            style: "transition-duration: 0s",
                            startNode: city.nodes.value[i],
                            endNode: city.nodes.value[j],
                            stroke: `rgb(${progress * 255}, 0, 0)`,
                            "stroke-width": 2 * progress + 2,
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            weight: i < j ? null : currentCity.value[i][j]
                        });
                    }
                }
            }
            return links;
        },
        visibility: () => showIf(Decimal.lt(citiesCompleted.value, 50))
    }));

    const checkCityProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 597,
        height: 24,
        style: {
            borderRadius: "var(--border-radius) var(--border-radius) 0 0",
            background: "var(--raised-background)",
            marginBottom: "-24px"
        },
        borderStyle: {
            borderRadius: "var(--border-radius) var(--border-radius) 0 0",
            borderColor: "transparent",
            marginBottom: "unset"
        },
        fillStyle: {
            background: "black",
            marginBottom: "unset"
        },
        progress() {
            return Decimal.div(
                routeIndex.value,
                typeof currentRoutes.value == "number"
                    ? Math.floor(currentRoutes.value)
                    : currentRoutes.value.length
            );
        },
        display: jsx(() => (
            <>
                {formatWhole(Math.floor(routeIndex.value))} /{" "}
                {formatWhole(
                    typeof currentRoutes.value == "number"
                        ? Math.floor(currentRoutes.value)
                        : currentRoutes.value.length
                )}
            </>
        ))
    }));

    const checkRouteProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 597,
        height: 24,
        style: {
            borderRadius: "0 0 var(--border-radius) var(--border-radius)",
            background: "var(--raised-background)",
            marginTop: "-24px"
        },
        borderStyle: {
            borderRadius: "0 0 var(--border-radius) var(--border-radius)",
            borderColor: "transparent",
            marginTop: "unset"
        },
        fillStyle: {
            background: "black",
            marginTop: "unset"
        },
        progress() {
            return Decimal.div(checkRouteProgress.value, currentRouteDuration.value);
        },
        display: jsx(() => (
            <>
                {formatWhole(Math.floor(checkRouteProgress.value))} /{" "}
                {formatWhole(currentRouteDuration.value)}
            </>
        ))
    }));

    const milestone1 = createMilestone(() => ({
        display: {
            requirement: "1 City Solved",
            effectDisplay: "Each city solved doubles manual and auto processing speed"
        },
        shouldEarn() {
            return Decimal.gte(citiesCompleted.value, 1);
        }
    }));
    const milestone2 = createMilestone(() => ({
        display: {
            requirement: "2 Cities Solved",
            effectDisplay:
                "Manually checking routes does additional work based on number of routes checked in this city"
        },
        shouldEarn() {
            return Decimal.gte(citiesCompleted.value, 2);
        },
        visibility: () => showIf(milestone1.earned.value)
    }));
    const milestone3 = createMilestone(() => ({
        display: {
            requirement: "3 Cities Solved",
            effectDisplay:
                "Each city solved makes the cooldown for removing a redundant route 25% shorter"
        },
        shouldEarn() {
            return Decimal.gte(citiesCompleted.value, 3);
        },
        visibility: () => showIf(milestone2.earned.value)
    }));
    const milestone4 = createMilestone(() => ({
        display: {
            requirement: "4 Cities Solved",
            effectDisplay:
                "Automatic processing speed is multiplied by the amount of redundant routes removed from this city"
        },
        shouldEarn() {
            return Decimal.gte(citiesCompleted.value, 4);
        },
        visibility: () => showIf(milestone3.earned.value)
    }));
    const milestone5 = createMilestone(() => ({
        display: {
            requirement: "5 Cities Solved",
            effectDisplay: "Remove 1 house from the map"
        },
        shouldEarn() {
            return Decimal.gte(citiesCompleted.value, 5);
        },
        onComplete() {
            generateCity();
        },
        visibility: () => showIf(milestone4.earned.value)
    }));
    const milestone6 = createMilestone(() => ({
        display: {
            requirement: "6 Cities Solved",
            effectDisplay:
                "Lower max weight to the min weight, and uncap amount of routes that can be checked per tick"
        },
        shouldEarn() {
            return Decimal.gte(citiesCompleted.value, 6);
        },
        visibility: () => showIf(milestone5.earned.value)
    }));
    const milestone7 = createMilestone(() => ({
        display: {
            requirement: "7 Cities Solved",
            effectDisplay: "All redundancies are removed"
        },
        shouldEarn() {
            return Decimal.gte(citiesCompleted.value, 7);
        },
        visibility: () => showIf(milestone6.earned.value)
    }));
    const milestones = {
        milestone1,
        milestone2,
        milestone3,
        milestone4,
        milestone5,
        milestone6,
        milestone7
    };
    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(milestones);

    // ---------------------------------------------------- Meta stuff

    const metaBuyables = {
        metal: createBuyable(() => ({
            resName: "Metal",
            resource: metal.metal,
            cost() {
                const amount = Decimal.mul(this.amount.value, 1.05);
                return Decimal.pow(5, amount).mul(1e83).div(Decimal.max(citiesCompleted.value, 1));
            },
            display: jsx(() => (
                <>
                    Upgrade computer
                    <br />
                    for {formatWhole(unref(metaBuyables.metal.cost ?? 0))} metal
                    <br />
                    Currently +{formatWhole(Decimal.mul(metaBuyables.metal.amount.value, 10))}%
                </>
            )),
            style: "width: 150px; min-height: 60px"
        })),
        console: createBuyable(() => ({
            resName: "Game Console",
            resource: factory.consoles,
            cost() {
                const amount = Decimal.mul(this.amount.value, 1.15);
                return Decimal.pow(1.2, amount)
                    .mul(1e11)
                    .div(Decimal.max(citiesCompleted.value, 1));
            },
            display: jsx(() => (
                <>
                    Upgrade computer
                    <br />
                    for {formatWhole(unref(metaBuyables.console.cost ?? 0))} game consoles
                    <br />
                    Currently +{formatWhole(Decimal.mul(metaBuyables.console.amount.value, 10))}%
                </>
            )),
            style: "width: 150px; min-height: 60px"
        })),
        classroom: createBuyable(() => ({
            resName: "Classroom",
            cost() {
                const amount = Decimal.mul(this.amount.value, 1.25);
                return Decimal.pow(1.2, amount)
                    .mul(1e6)
                    .div(Decimal.max(citiesCompleted.value, 1).pow(0.5));
            },
            canPurchase() {
                return Decimal.gte(
                    management.classrooms.amount.value,
                    unref(metaBuyables.classroom.cost ?? 0)
                );
            },
            onPurchase() {
                management.classrooms.amount.value = Decimal.sub(
                    management.classrooms.amount.value,
                    unref(metaBuyables.classroom.cost ?? 0)
                );
                this.amount.value = Decimal.add(this.amount.value, 1);
            },
            display: jsx(() => (
                <>
                    Upgrade computer
                    <br />
                    for {formatWhole(unref(metaBuyables.classroom.cost ?? 0))} classrooms
                    <br />
                    Currently +{formatWhole(Decimal.mul(metaBuyables.classroom.amount.value, 10))}%
                </>
            )),
            style: "width: 150px; min-height: 60px"
        })),
        tick: createBuyable(() => ({
            resName: "Factory Tick Rate",
            cost() {
                const amount = Decimal.mul(this.amount.value, 1.15);
                return Decimal.pow(1.5, amount)
                    .mul(5e6)
                    .div(Decimal.max(citiesCompleted.value, 1).pow(0.5));
            },
            canPurchase() {
                return Decimal.gte(
                    factory.computedTickRate.value,
                    unref(metaBuyables.tick.cost ?? 0)
                );
            },
            onPurchase() {
                this.amount.value = Decimal.add(this.amount.value, 1);
            },
            display: jsx(() => (
                <>
                    Upgrade computer
                    <br />
                    for {formatWhole(unref(metaBuyables.tick.cost ?? 0))} factory tick rate
                    <br />
                    Currently +{formatWhole(Decimal.mul(metaBuyables.tick.amount.value, 10))}%
                </>
            )),
            style: "width: 150px; min-height: 60px"
        }))
    } as Record<string, GenericBuyable & { resName: string }>;

    const metaMilestones = {
        0: createMilestone(() => ({
            display: {
                requirement: "1000 Cities Solved",
                effectDisplay: "Each city generates 1 classroom per minute"
            },
            shouldEarn() {
                return Decimal.gte(citiesCompleted.value, 1000);
            }
        })),
        1: createMilestone(() => ({
            display: {
                requirement: "5000 Cities Solved",
                effectDisplay:
                    "Elves can learn past level 5 and gain 0.5 base city solved per second for each level elves learnt"
            },
            shouldEarn() {
                return Decimal.gte(citiesCompleted.value, 5000);
            },
            visibility: () => showIf(metaMilestones[0].earned.value)
        })),
        2: createMilestone(() => ({
            display: {
                requirement: "25,000 Cities Solved",
                effectDisplay: jsx(() => (
                    <>
                        Multiply factory tick rate by log<sub>10</sub>(cities solved) - 3
                    </>
                ))
            },
            shouldEarn() {
                return Decimal.gte(citiesCompleted.value, 25000);
            },
            visibility: () => showIf(metaMilestones[1].earned.value)
        })),
        3: createMilestone(() => ({
            display: {
                requirement: "80,000 Cities Solved",
                effectDisplay: "Multiply game console production by 6"
            },
            shouldEarn() {
                return Decimal.gte(citiesCompleted.value, 80000);
            },
            visibility: () => showIf(metaMilestones[2].earned.value)
        })),
        4: createMilestone(() => ({
            display: {
                requirement: "300,000 Cities Solved",
                effectDisplay:
                    "Multiply the amount of factory input resources by the amount of their corresponding warehouses appeared in the factory, plus 1. Also unlocks a button to fill your factory with warehouses."
            },
            shouldEarn() {
                return Decimal.gte(citiesCompleted.value, 300000);
            },
            visibility: () => showIf(metaMilestones[3].earned.value)
        })),
        5: createMilestone(() => ({
            display: {
                requirement: "600,000 Cities Solved",
                effectDisplay: "Quadruple oil gain"
            },
            shouldEarn() {
                return Decimal.gte(citiesCompleted.value, 600000);
            },
            visibility: () => showIf(metaMilestones[4].earned.value)
        })),
        6: createMilestone(() => ({
            display: {
                requirement: "1,000,000 Cities Solved",
                effectDisplay: jsx(() => (
                    <>
                        Increases base city solving speed by{" "}
                        <Fraction>
                            <div>factory tick rate</div>
                            <div>100</div>
                        </Fraction>
                    </>
                ))
            },
            shouldEarn() {
                return Decimal.gte(citiesCompleted.value, 1000000);
            },
            visibility: () => showIf(metaMilestones[5].earned.value)
        }))
    } as Record<number, GenericMilestone>;
    const { collapseMilestones: collapseMetaMilestones, display: metaMilestonesDisplay } =
        createCollapsibleMilestones(metaMilestones);

    const houses = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: citiesCompleted,
            description: "Cities Completed"
        })),
        createAdditiveModifier(() => ({
            addend: -1,
            description: "5 Cities Completed",
            enabled: milestone5.earned
        }))
    ]);
    const computedHouses = computed(() => houses.apply(3));
    const maxWeight = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.pow(citiesCompleted.value, 1.1),
            description: "Cities Completed"
        }))
    ]);
    const computedMaxWeight = computed(() => maxWeight.apply(10));
    const minWeight = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: citiesCompleted,
            description: "Cities Completed"
        })),
        createExponentialModifier(() => ({
            exponent: 3,
            description: "Cities Completed",
            enabled: milestone7.earned
        }))
    ]);
    const computedMinWeight = computed(() => minWeight.apply(2));
    const manualBoost = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.add(routeIndex.value, 1).sqrt(),
            description: "2 Cities Solved",
            enabled: milestone2.earned
        }))
    ]);
    const computedManualBoost = computed(() => manualBoost.apply(1));
    const manualCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(0.5, citiesCompleted.value),
            description: "1 City Solved",
            enabled: milestone1.earned
        }))
    ]);
    const computedManualCooldown = computed(() => manualCooldown.apply(1));
    const redundantCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(0.75, citiesCompleted.value),
            description: "3 Cities Solved",
            enabled: milestone3.earned
        }))
    ]);
    const computedRedundantCooldown = computed(() => redundantCooldown.apply(10));
    const autoProcessing = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(2, citiesCompleted.value),
            description: "1 City Solved",
            enabled: milestone1.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(redundanciesRemoved.value, 1),
            description: "4 Cities Solved",
            enabled: milestone4.earned
        }))
    ]);
    const computedAutoProcessing = computed(() => autoProcessing.apply(1));
    const metaSolvingSpeed = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.div(management.totalElfLevels.value, 2),
            description: "5000 Cities Solved",
            enabled: metaMilestones[1].earned
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.div(factory.computedTickRate.value, 100),
            description: "1,000,000 Cities Solved",
            enabled: metaMilestones[6].earned
        })),
        ...Object.values(metaBuyables).map(x =>
            createMultiplicativeModifier(() => ({
                multiplier: () => Decimal.div(x.amount.value, 10).add(1),
                description: x.resName + " Upgrade",
                enabled: () => Decimal.gte(x.amount.value, 1)
            }))
        )
    ]) as WithRequired<Modifier, "description">;
    const computedMetaSolvingSpeed = computed(() => metaSolvingSpeed.apply(50));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Houses per City",
            modifier: houses,
            base: 3,
            visible: () => Decimal.lte(citiesCompleted.value, 50)
        },
        {
            title: () => (milestone6.earned.value ? "Weight" : "Minimum Weight"),
            modifier: minWeight,
            base: 2,
            visible: () => Decimal.lte(citiesCompleted.value, 50)
        },
        {
            title: "Maximum Weight",
            modifier: maxWeight,
            base: 10,
            visible: () => !milestone6.earned.value && Decimal.lte(citiesCompleted.value, 50)
        },
        {
            title: "Manual Processing Amount",
            modifier: manualBoost,
            base: 1,
            visible: () => Decimal.lte(citiesCompleted.value, 50)
        },
        {
            title: "Manual Processing Cooldown",
            modifier: manualCooldown,
            base: 1,
            unit: "s",
            visible: () => Decimal.lte(citiesCompleted.value, 50)
        },
        {
            title: "Remove Redundant Route Cooldown",
            modifier: redundantCooldown,
            base: 10,
            unit: "s",
            visible: () => Decimal.lte(citiesCompleted.value, 50)
        },
        {
            title: "Auto Processing Speed",
            modifier: autoProcessing,
            base: 1,
            unit: "/s",
            visible: () => Decimal.lte(citiesCompleted.value, 50)
        },
        {
            title: "Post-Inflation Solving Speed",
            modifier: metaSolvingSpeed,
            base: 50,
            unit: "/s",
            visible: () => Decimal.gt(citiesCompleted.value, 50)
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
        if (Decimal.lte(citiesCompleted.value, 50)) {
            if (Decimal.gte(newCityProgress.value, 10)) {
                newCityProgress.value = 10;
            } else {
                newCityProgress.value = Decimal.add(newCityProgress.value, diff);
                if (getNewCity.isHolding.value) {
                    getNewCity.onClick();
                }
            }

            if (Decimal.gte(boostProgress.value, computedManualCooldown.value)) {
                boostProgress.value = computedManualCooldown.value;
            } else {
                boostProgress.value = Decimal.add(boostProgress.value, diff);
                if (boost.isHolding.value) {
                    boost.onClick();
                }
            }

            if (Decimal.gte(redundantProgress.value, computedRedundantCooldown.value)) {
                redundantProgress.value = computedRedundantCooldown.value;
            } else {
                redundantProgress.value = Decimal.add(redundantProgress.value, diff);
                if (removeRedundantRoute.isHolding.value) {
                    removeRedundantRoute.onClick();
                }
            }

            checkRouteProgress.value = Decimal.times(diff, computedAutoProcessing.value)
                .add(checkRouteProgress.value)
                .toNumber();
            if (checkRouteProgress.value > currentRouteDuration.value) {
                const overflow = checkRouteProgress.value - currentRouteDuration.value;
                routeIndex.value++;
                if (milestone6.earned.value && currentRoute.value != null) {
                    const length =
                        typeof currentRoute.value === "number"
                            ? currentRoute.value
                            : currentRoute.value.length;
                    const extraRoutes = Decimal.div(
                        overflow,
                        Decimal.times(length, computedMinWeight.value)
                    )
                        .floor()
                        .toNumber();
                    routeIndex.value += extraRoutes;
                }
                getNextRoute();
            }
        } else {
            citiesCompleted.value = Decimal.add(
                citiesCompleted.value,
                Decimal.times(computedMetaSolvingSpeed.value, diff)
            ).min(5000000);

            if (metaMilestones[0].earned.value) {
                management.classrooms.amount.value = Decimal.add(
                    management.classrooms.amount.value,
                    Decimal.times(citiesCompleted.value, diff).div(60)
                );
            }
        }
    });

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${color}`,
        textStyle: {
            color: "var(--feature-foreground)"
        },
        progress: () =>
            main.day.value === day ? Decimal.div(citiesCompleted.value, citiesGoal) : 1,
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {formatWhole(citiesCompleted.value)}/{formatWhole(citiesGoal)}
                </>
            ) : (
                ""
            )
        )
    })) as GenericBar;

    watchEffect(() => {
        if (main.day.value === day && Decimal.gte(citiesCompleted.value, citiesGoal)) {
            main.completeDay();
        }
    });

    function displayRoutes() {
        if (currentRoute.value == null) {
            return "";
        }
        if (typeof currentRoutes.value === "number") {
            return <div class="routes-list">&nbsp;</div>;
        }
        if (typeof currentRoutes.value === "number") {
            console.error("Something went horribly wrong");
            return;
        }
        const routes = currentRoutes.value.slice();
        let showPrevious = false;
        if (routes.length > 25) {
            routes.splice(0, Math.max(routeIndex.value - 12, 0));
            showPrevious = true;
            if (routes.length > 25) {
                routes.splice(25);
            }
        }
        return (
            <div class="routes-list">
                {routes.map((route, i) => {
                    const index = i + (showPrevious ? Math.max(routeIndex.value - 12, 0) : 0);
                    return (
                        <div
                            class={{
                                redundant: route[0] > route[1],
                                checked: routeIndex.value > index,
                                processing: routeIndex.value === index,
                                skipped:
                                    routeIndex.value < index && routesToSkip.value.includes(index)
                            }}
                            style={{
                                "--opacity": 1 - Math.abs(index - routeIndex.value) / 13
                            }}
                        >
                            {stringifyRoute(route)}
                        </div>
                    );
                })}
            </div>
        );
    }

    return {
        name,
        day,
        color,
        citiesCompleted,
        currentCity,
        routeIndex,
        checkRouteProgress,
        newCityProgress,
        boostProgress,
        redundantProgress,
        generalTabCollapsed,
        currentRoutes,
        redundantRoutes,
        routesToSkip,
        redundanciesRemoved,
        city,
        metaBuyables,
        milestones,
        collapseMilestones,
        metaMilestones,
        collapseMetaMilestones,
        minWidth: 700,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day
                        ? `Solve ${formatWhole(citiesGoal)} cities to complete the day`
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
                <MainDisplay resource={citiesCompleted} color={color} />
                {Decimal.lte(citiesCompleted.value, 50) ? (
                    <>
                        {renderRow(boost, removeRedundantRoute)}
                        {render(checkCityProgressBar)}
                        {displayRoutes()}
                        {render(city)}
                        {render(checkRouteProgressBar)}
                        <Spacer />
                        {milestonesDisplay()}
                    </>
                ) : (
                    <>
                        {Decimal.lt(citiesCompleted.value, citiesGoal) ? (
                            <>
                                You're solving {formatWhole(computedMetaSolvingSpeed.value)} cities
                                per second
                                <Spacer />
                                {renderRow(...Object.values(metaBuyables))}
                            </>
                        ) : (
                            <>
                                You've solved all cities on Earth!
                                <br />
                                <span style="text-decoration: line-through; font-size: smaller">
                                    (and proved the travelling salesman problem to be O(1))
                                </span>
                            </>
                        )}
                        <Spacer />
                        {metaMilestonesDisplay()}
                    </>
                )}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} <span class="desc">{formatWhole(citiesCompleted.value)} cities solved</span>
            </div>
        ))
    };
});

export default layer;
