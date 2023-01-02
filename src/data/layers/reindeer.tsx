/**
 * @module
 * @hidden
 */
import HotkeyVue from "components/Hotkey.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { jsx } from "features/feature";
import { createHotkey, GenericHotkey } from "features/hotkey";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createMultiplicativeModifier,
    createSequentialModifier
} from "game/modifiers";
import { persistent } from "game/persistence";
import { createCostRequirement } from "game/requirements";
import Decimal, { DecimalSource, format, formatTime, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderGrid } from "util/vue";
import { computed, ref, unref, watchEffect } from "vue";
import boxes from "./boxes";
import cloth from "./cloth";
import coal from "./coal";
import dyes from "./dyes";
import metal from "./metal";
import oil from "./oil";
import paper from "./paper";
import plastic from "./plastic";
import "./styles/reindeer.css";
import trees from "./trees";

const id = "reindeer";
const day = 21;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Reindeer";
    const color = "saddlebrown";

    const feedGoal = 1.5e3;

    const timeSinceFocus = persistent<number>(0);

    const currMultiplier = persistent<DecimalSource>(1);
    const currTargets = persistent<Record<string, boolean>>({});
    const currCooldown = persistent<number>(0);
    const crit = persistent<number>(0);

    const maxMultiplier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Carry food in boxes",
            enabled: upgrade4.bought
        }))
    ]);
    const computedMaxMultiplier = computed(() => maxMultiplier.apply(2));
    const targetsCount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 1,
            description: "Guide to Reindeer Handling",
            enabled: upgrade3.bought
        })),
        createAdditiveModifier(() => ({
            addend: crit,
            description: "Metal clapper",
            enabled: upgrade5.bought
        }))
    ]);
    const computedTargetsCount = computed(() => targetsCount.apply(1));
    const computedMaxCooldown = computed(() => 10);

    function focus() {
        currCooldown.value = Decimal.fromValue(computedMaxCooldown.value).toNumber();
        let targetsSelected = 0;
        currTargets.value = {};
        timeSinceFocus.value = 0;
        while (Decimal.gt(computedTargetsCount.value, targetsSelected)) {
            const selectedReindeer =
                Object.values(reindeer)[Math.floor(Math.random() * Object.values(reindeer).length)];
            const roll = selectedReindeer?.name ?? "";
            if (!currTargets.value[roll]) {
                currTargets.value[roll] = true;
                targetsSelected++;
                if (upgrade8.bought.value) {
                    selectedReindeer.onClick();
                }
            }
        }
    }

    const focusMeter = createBar(() => ({
        direction: Direction.Right,
        width: 476,
        height: 50,
        style: `border-radius: 0`,
        borderStyle: `border-radius: 0`,
        fillStyle: () => ({
            background: currCooldown.value > 0 ? color : "#7f7f00",
            animation: currCooldown.value > 0 ? "1s focused-eating-bar linear infinite" : "",
            opacity: currCooldown.value > 0 ? currCooldown.value / 10 : 1,
            transition: "none"
        }),
        progress: () =>
            Decimal.sub(currMultiplier.value, 1)
                .div(Decimal.sub(computedMaxMultiplier.value, 1))
                .toNumber(),
        display: jsx(() => (
            <>
                {format(currMultiplier.value)}x
                {currCooldown.value > 0 ? (
                    <>
                        {" "}
                        to {Object.keys(currTargets.value).join(", ")} for{" "}
                        {formatTime(currCooldown.value)}
                    </>
                ) : (
                    ""
                )}
            </>
        ))
    })) as GenericBar;

    const focusButton = createClickable(() => ({
        display: {
            title: "Focus",
            description: jsx(() => (
                <>
                    Motivate reindeer to eat, multiplying {formatWhole(computedTargetsCount.value)}{" "}
                    random reindeer's eating rate by up to {format(computedMaxMultiplier.value)}x
                    for {formatTime(computedMaxCooldown.value)}, equal to the focus bar's effect.
                </>
            ))
        },
        style: {
            width: "480px",
            minHeight: "80px",
            zIndex: 4
        },
        canClick: () => Decimal.eq(currCooldown.value, 0),
        onClick: focus
    }));

    const cooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 0.5,
            description: "Pile of coal",
            enabled: upgrade2.bought
        }))
    ]);
    const computedCooldown = computed(() => cooldown.apply(10));

    function createReindeer(options: {
        name: string;
        key: string;
        boostDescription: string;
        boostAmount: DecimalSource;
    }) {
        const timesFed = persistent<DecimalSource>(0);
        const progress = persistent<DecimalSource>(0);

        const hotkey = createHotkey(() => ({
            key: "Numpad " + options.key,
            description: "Feed " + options.name,
            enabled: main.days[day - 1].opened,
            onPress: clickable.onClick
        })) as GenericHotkey;

        const clickable = createClickable(() => {
            const progressBar = createBar(() => ({
                direction: Direction.Right,
                width: 140,
                height: 10,
                style: "margin-top: 8px",
                borderStyle: "border-color: black",
                baseStyle: "margin-top: -1px",
                fillStyle: () => ({
                    marginTop: "-1px",
                    transitionDuration: "0s",
                    background: "black",
                    animation:
                        currTargets.value[options.name] && currCooldown.value > 0
                            ? ".5s focused-eating-bar linear infinite"
                            : ""
                }),
                progress: () => Decimal.div(progress.value, computedCooldown.value)
            }));

            const modifier = createMultiplicativeModifier(() => ({
                multiplier: effect,
                description: options.name,
                enabled: () => Decimal.gt(timesFed.value, 0)
            }));

            const effect = computed(() =>
                Decimal.times(options.boostAmount, timesFed.value)
                    .add(1)
                    .pow(upgrade9.bought.value ? 1.1 : 1)
            );

            return {
                ...options,
                hotkey,
                timesFed,
                progress,
                effect,
                modifier,
                display: {
                    title: jsx(() => (
                        <h3>
                            Feed {options.name} <HotkeyVue hotkey={hotkey} />
                        </h3>
                    )),
                    description: jsx(() => (
                        <>
                            <br />
                            Each time you feed {options.name} will increase your{" "}
                            {options.boostDescription} by +{format(options.boostAmount)}x
                            <Spacer />
                            Currently {format(effect.value)}x
                            <br />
                            {render(progressBar)}
                        </>
                    ))
                },
                style: {
                    width: "160px",
                    height: "160px"
                },
                canClick() {
                    return Decimal.gte(progress.value, computedCooldown.value);
                },
                onClick() {
                    if (!unref(clickable.canClick)) {
                        return;
                    }
                    let amount = Decimal.div(progress.value, computedCooldown.value).floor();
                    if (upgrade1.bought.value) {
                        amount = Decimal.times(amount, 2);
                    }
                    timesFed.value = Decimal.add(timesFed.value, amount);
                    progress.value = 0;
                },
                update(diff: number) {
                    if (Decimal.gte(progress.value, computedCooldown.value)) {
                        progress.value = computedCooldown.value;
                    } else {
                        let amount: DecimalSource = diff;
                        const isFocused = currTargets.value[options.name] && currCooldown.value > 0;
                        if (isFocused) {
                            amount = Decimal.times(amount, currMultiplier.value);
                        }
                        progress.value = Decimal.add(progress.value, amount);
                        if (clickable.isHolding.value || (upgrade8.bought.value && isFocused)) {
                            clickable.onClick();
                        }
                    }
                }
            };
        });
        return clickable;
    }
    const dasher = createReindeer({
        name: "Dasher",
        key: "7",
        boostDescription: "log gain",
        boostAmount: 1
    });
    const dancer = createReindeer({
        name: "Dancer",
        key: "8",
        boostDescription: "coal gain",
        boostAmount: 0.1
    });
    const prancer = createReindeer({
        name: "Prancer",
        key: "9",
        boostDescription: "paper gain",
        boostAmount: 0.1
    });
    const vixen = createReindeer({
        name: "Vixen",
        key: "4",
        boostDescription: "boxes gain",
        boostAmount: 0.1
    });
    const comet = createReindeer({
        name: "Comet",
        key: "5",
        boostDescription: "metal gain",
        boostAmount: 0.1
    });
    const cupid = createReindeer({
        name: "Cupid",
        key: "6",
        boostDescription: "cloth actions",
        boostAmount: 0.1
    });
    const donner = createReindeer({
        name: "Donner",
        key: "1",
        boostDescription: "oil gain",
        boostAmount: 0.01
    });
    const blitzen = createReindeer({
        name: "Blitzen",
        key: "2",
        boostDescription: "plastic gain",
        boostAmount: 0.1
    });
    const rudolph = createReindeer({
        name: "Rudolph",
        key: "3",
        boostDescription: "dye gain",
        boostAmount: 0.01
    });
    // order is designed so hotkeys appear 1-9, even though they're displayed in numpad order in the layer itself
    const reindeer = { donner, blitzen, rudolph, vixen, comet, cupid, dasher, dancer, prancer };

    const sumTimesFed = computed(() =>
        Object.values(reindeer)
            .map(r => r.timesFed.value)
            .reduce(Decimal.add, Decimal.dZero)
    );

    const upgrade1 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: trees.logs,
            cost: 1e97
        })),
        style: {
            width: "160px"
        },
        display: {
            title: "Sawdust?",
            description:
                "Adding some sawdust to the feed allows you to make more of it. Each feed action counts twice"
        }
    }));
    const upgrade2 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: coal.coal,
            cost: 1e167
        })),
        style: {
            width: "160px"
        },
        display: {
            title: "Pile of coal",
            description:
                "Building a threatening pile of coal encourages the reindeer to behave. Each reindeer eats twice as fast"
        }
    }));
    const upgrade3 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: paper.paper,
            cost: 1e117
        })),
        style: {
            width: "160px"
        },
        display: {
            title: "Guide to Reindeer Handling",
            description:
                "Written reindeer handling instructions allow you to help more focus at once. Increase focus targets by one"
        }
    }));
    const upgrade4 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: boxes.boxes,
            cost: 1e102
        })),
        style: {
            width: "160px"
        },
        display: {
            title: "Carry food in boxes",
            description:
                "Carrying reindeer food in boxes allows you to distribute it faster. Double the maximum focus multiplier"
        }
    }));
    const upgrade5 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: metal.metal,
            cost: 1e67
        })),
        style: {
            width: "160px"
        },
        display: {
            title: "Metal clapper",
            description:
                'Striking two rods of metal can help get more reindeer\'s attention when done right. "Critical" focuses now affect up to two additional reindeer'
        }
    }));
    const upgrade6 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: cloth.cloth,
            cost: 1e20
        })),
        style: {
            width: "160px"
        },
        display: {
            title: "Focus bar padding",
            description:
                "Adding padding to the focus bar lets you slow it down when it's closer to the max value"
        }
    }));
    const upgrade7 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: oil.oil,
            cost: 4e25
        })),
        style: {
            width: "160px"
        },
        display: {
            title: "Oil can do that?",
            description:
                "Using a lot of oil somehow let's reindeers focus themselves with a random value when left un-focused for 10s"
        }
    }));
    const upgrade8 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: plastic.plastic,
            cost: 1e22
        })),
        style: {
            width: "160px"
        },
        display: {
            title: "Automated feeder",
            description: "An automated feeder lets focused reindeer eat automatically"
        }
    }));
    const upgrade9 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: dyes.dyes.white.amount,
            cost: 7.5e7,
            pay() {
                dyes.dyes.white.buyable.amount.value = 0;
            }
        })),
        style: {
            width: "160px"
        },
        display: {
            title: "Colorful food",
            description:
                "Adding some non-toxic dyes to the food makes them more powerful. Raise each reindeer's effect to the ^1.1"
        }
    }));
    const upgrades = {
        upgrade1,
        upgrade2,
        upgrade3,
        upgrade4,
        upgrade5,
        upgrade6,
        upgrade7,
        upgrade8,
        upgrade9
    };

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Max Focus Multiplier",
            modifier: maxMultiplier,
            base: 2
        },
        {
            title: "Focus Targets",
            modifier: targetsCount,
            base: 1
        },
        {
            title: "Eating duration",
            modifier: cooldown,
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

    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }

        Object.values(reindeer).forEach(reindeer => reindeer.update(diff));

        currCooldown.value = Math.max(currCooldown.value - diff, 0);

        let auto = false;
        if (upgrade7.bought.value) {
            timeSinceFocus.value += diff;
            if (timeSinceFocus.value > 20) {
                auto = true;
            }
        }

        if (Decimal.eq(currCooldown.value, 0)) {
            let speed = 1000;
            if (auto) {
                speed = Math.random() * 1000;
            }
            let stoppedAt = 1 - Math.abs(Math.sin((Date.now() / speed) * 2));
            if (upgrade6.bought.value) {
                stoppedAt = 1 - (1 - stoppedAt) ** 2;
            }
            crit.value = stoppedAt > 0.975 ? 2 : stoppedAt > 0.9 ? 1 : 0;
            currMultiplier.value = Decimal.pow(computedMaxMultiplier.value, stoppedAt);
            if (auto) {
                focus();
            }
        }
    });

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `animation: 15s reindeer-bar linear infinite`,
        progress: () => (main.day.value === day ? Decimal.div(sumTimesFed.value, feedGoal) : 1),
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {formatWhole(sumTimesFed.value)}/{formatWhole(feedGoal)}
                </>
            ) : (
                ""
            )
        )
    })) as GenericBar;

    watchEffect(() => {
        if (main.day.value === day && Decimal.gte(sumTimesFed.value, feedGoal)) {
            main.completeDay();
        }
    });

    return {
        name,
        day,
        color,
        reindeer,
        generalTabCollapsed,
        timeSinceFocus,
        currMultiplier,
        currTargets,
        currCooldown,
        upgrades,
        crit,
        minWidth: 700,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day
                        ? `Feed reindeer ${formatWhole(feedGoal)} times to complete the day`
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
                <div>You have fed reindeer {formatWhole(sumTimesFed.value)} times</div>
                <Spacer />
                {renderGrid(
                    [focusButton],
                    [focusMeter],
                    [dasher, dancer, prancer],
                    [vixen, comet, cupid],
                    [donner, blitzen, rudolph]
                )}
                <Spacer />
                {renderGrid(
                    [upgrade1, upgrade2, upgrade3],
                    [upgrade4, upgrade5, upgrade6],
                    [upgrade7, upgrade8, upgrade9]
                )}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} <span class="desc">{format(sumTimesFed.value)} times fed</span>
            </div>
        ))
    };
});

export default layer;
