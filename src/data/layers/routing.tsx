/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { BoardNode, BoardNodeLink, createBoard, Shape } from "features/boards/board";
import { createClickable } from "features/clickables/clickable";
import { jsx } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { createTab } from "features/tabs/tab";
import { createTabFamily } from "features/tabs/tabFamily";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { createAdditiveModifier, createSequentialModifier } from "game/modifiers";
import { persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderRow } from "util/vue";
import { computed, ref, unref, watchEffect } from "vue";
import "./styles/routing.css";

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

    const citiesGoal = 25;

    const citiesCompleted = createResource<DecimalSource>(0, "cities solved");
    const currentCity = persistent<number[][]>([]);
    const routeIndex = persistent<number>(0);
    const checkRouteProgress = persistent<number>(0);

    const currentRoutes = computed(() => {
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
        return currentRoutes.value.filter(route => route[0] > route[1]);
    });
    const routesToSkip = ref<number[]>([]);

    const currentRoute = computed(() => currentRoutes.value[routeIndex.value]);

    const currentRouteDuration = computed(() => {
        const route = currentRoute.value;
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
            .join("->");
    }

    function generateCity() {
        const numHouses = new Decimal(computedHouses.value).clampMin(3).toNumber();
        const min = computedMinWeight.value;
        const max = computedMaxWeight.value;
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
        getNextRoute();
    }

    function getNextRoute() {
        while (
            routeIndex.value <= currentRoutes.value.length &&
            routesToSkip.value.includes(routeIndex.value)
        ) {
            routeIndex.value++;
        }
        if (routeIndex.value > currentRoutes.value.length) {
            generateCity();
        } else {
            if (redundantRoutes.value.includes(currentRoute.value)) {
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
        canClick: () =>
            Decimal.gte(redundantProgress.value, computedRedundantCooldown.value) &&
            routesToSkip.value.length < redundantRoutes.value.length,
        onClick() {
            if (!unref(removeRedundantRoute.canClick)) {
                return;
            }
            routesToSkip.value = [
                ...routesToSkip.value,
                currentRoutes.value.indexOf(redundantRoutes.value[routesToSkip.value.length])
            ];
            redundantProgress.value = 0;
        }
    }));

    const city = createBoard(() => ({
        startNodes: () => [],
        types: {
            house: {
                shape: Shape.Circle,
                fillColor: "var(--highlighted)",
                outlineColor(node) {
                    return currentRoute.value.includes(node.state as number)
                        ? "var(--accent1)"
                        : "var(--outline)";
                },
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
        style: {
            background: "var(--raised-background)",
            borderRadius: "var(--border-radius) var(--border-radius) 0 0",
            boxShadow: "0 2px 10px rgb(0 0 0 / 50%)"
        },
        state: computed(() => {
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
            const links: BoardNodeLink[] = [];
            const citySize = currentCity.value.length;
            for (let i = 0; i < citySize; i++) {
                for (let j = 0; j < citySize; j++) {
                    if (i !== j) {
                        // Bloody O(n^2) performance Batman!
                        let isActive = false;
                        const endPoints = [
                            currentRoute.value[0],
                            currentRoute.value[currentRoute.value.length - 1]
                        ];
                        if (
                            (!endPoints.includes(i) || !endPoints.includes(j)) &&
                            currentRoute.value.includes(i) &&
                            currentRoute.value.includes(j)
                        ) {
                            isActive = true;
                        }
                        links.push({
                            startNode: city.nodes.value[i],
                            endNode: city.nodes.value[j],
                            stroke: isActive ? "red" : "white",
                            "stroke-width": isActive ? 4 : 2,
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            weight: i < j ? null : currentCity.value[i][j]
                        });
                    }
                }
            }
            return links;
        }
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
            borderColor: "var(--outline)",
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
                {Math.floor(checkRouteProgress.value)}/{currentRouteDuration.value}
            </>
        ))
    }));

    const houses = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: citiesCompleted,
            description: "Cities Completed"
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
        }))
    ]);
    const computedMinWeight = computed(() => minWeight.apply(2));
    const manualBoost = createSequentialModifier(() => []);
    const computedManualBoost = computed(() => manualBoost.apply(1));
    const manualCooldown = createSequentialModifier(() => []);
    const computedManualCooldown = computed(() => manualCooldown.apply(1));
    const redundantCooldown = createSequentialModifier(() => []);
    const computedRedundantCooldown = computed(() => redundantCooldown.apply(10));
    const autoProcessing = createSequentialModifier(() => []);
    const computedAutoProcessing = computed(() => autoProcessing.apply(1));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Houses/city",
            modifier: houses,
            base: 3
        },
        {
            title: "Minimum Weight",
            modifier: minWeight,
            base: 2
        },
        {
            title: "Manual Processing Amount",
            modifier: manualBoost,
            base: 1
        },
        {
            title: "Manual Processing Cooldown",
            modifier: manualCooldown,
            base: 1,
            unit: "s"
        },
        {
            title: "Remove Redundant Route Cooldown",
            modifier: redundantCooldown,
            base: 10,
            unit: "s"
        },
        {
            title: "Auto Processing Speed",
            modifier: autoProcessing,
            base: 1,
            unit: "/s"
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
            routeIndex.value++;
            getNextRoute();
        }
    });

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${color}`,
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

    const tabs = createTabFamily({
        routes: () => ({
            display: "Routes to check",
            tab: createTab(() => ({
                display: jsx(() => (
                    <div class="routes-list">
                        {currentRoutes.value.map((route, index) => (
                            <div
                                class={{
                                    redundant: route[0] > route[1],
                                    checked: routeIndex.value > index,
                                    processing: routeIndex.value === index,
                                    skipped:
                                        routeIndex.value < index &&
                                        routesToSkip.value.includes(index)
                                }}
                            >
                                {stringifyRoute(route)}
                            </div>
                        ))}
                    </div>
                ))
            }))
        })
    });

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
        city,
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
                {renderRow(getNewCity, boost, removeRedundantRoute)}
                {render(city)}
                {render(checkRouteProgressBar)}
                {render(tabs)}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} <span class="desc">{format(citiesCompleted.value)} cities solved</span>
            </div>
        ))
    };
});

export default layer;
