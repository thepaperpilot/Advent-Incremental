/**
 * @module
 * @hidden
 */
import HotkeyVue from "components/Hotkey.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { jsx } from "features/feature";
import { createHotkey, GenericHotkey } from "features/hotkey";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, Resource } from "features/resources/resource";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderGrid } from "util/vue";
import { computed, ref, unref, watchEffect } from "vue";

const id = "reindeer";
const day = 21;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Reindeer";
    const color = "saddlebrown";

    const feedGoal = 1e3;

    // TODO focus

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
            const computedCooldown = computed(() => 10);

            const progressBar = createBar(() => ({
                direction: Direction.Right,
                width: 140,
                height: 10,
                style: "margin-top: 8px",
                borderStyle: "border-color: black",
                baseStyle: "margin-top: -1px",
                fillStyle: "margin-top: -1px; transition-duration: 0s; background: black",
                progress: () => Decimal.div(progress.value, computedCooldown.value)
            }));

            return {
                ...options,
                hotkey,
                timesFed,
                progress,
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
                            Currently {format(Decimal.pow(options.boostAmount, timesFed.value))}x
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
                    const amount = Decimal.div(progress.value, computedCooldown.value);
                    timesFed.value = Decimal.add(timesFed.value, amount);
                    progress.value = 0;
                },
                update(diff: number) {
                    console.log(progress.value, computedCooldown.value, diff);
                    if (Decimal.gte(progress.value, computedCooldown.value)) {
                        progress.value = computedCooldown.value;
                    } else {
                        progress.value = Decimal.add(progress.value, diff);
                        if (clickable.isHolding.value) {
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
    const reindeer = { dasher, dancer, prancer, vixen, comet, cupid, donner, blitzen, rudolph };

    const sumTimesFed = computed(() =>
        Object.values(reindeer)
            .map(r => r.timesFed.value)
            .reduce(Decimal.add, Decimal.dZero)
    );

    // TODO upgrades

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => []);
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
    });

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${color}`,
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
                    [dasher, dancer, prancer],
                    [vixen, comet, cupid],
                    [donner, blitzen, rudolph]
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
