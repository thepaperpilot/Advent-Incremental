import "@fontsource/material-icons";
import Spacer from "components/layout/Spacer.vue";
import { CoercableComponent, Component, GatherProps, GenericComponent, jsx } from "features/feature";
import { BaseLayer, createLayer, GenericLayer, layers } from "game/layers";
import { persistent } from "game/persistence";
import type { PlayerData } from "game/player";
import player from "game/player";
import { format, formatTime } from "util/bignum";
import { Computable, convertComputable, ProcessedComputable } from "util/computed";
import { createLazyProxy } from "util/proxies";
import { renderRow, VueFeature } from "util/vue";
import type { Ref } from "vue";
import { computed, ref, unref } from "vue";
import "./advent.css";
import Day from "./Day.vue";
import trees from "./layers/trees";

export interface Day extends VueFeature {
    day: number;
    layer: string | null;
    symbol: CoercableComponent;
    story: string;
    opened: Ref<boolean>;
    shouldNotify: ProcessedComputable<boolean>;
}

export const main = createLayer("main", function (this: BaseLayer) {
    const day = persistent<number>(1);

    const loreTitle = ref<string>("");
    const loreBody = ref<string>("");

    function createDay(
        optionsFunc: () => {
            day: number;
            shouldNotify: Computable<boolean>;
            layer: string | null;
            symbol: CoercableComponent;
            story: string;
        }
    ): Day {
        const opened = persistent<boolean>(false);

        return createLazyProxy(() => {
            const day = optionsFunc();

            const shouldNotify = convertComputable(day.shouldNotify);

            return {
                ...day,
                opened,
                shouldNotify,
                [Component]: Day as GenericComponent,
                [GatherProps]: function (this: Day) {
                    const { day, layer, symbol, opened, shouldNotify, story } = this;
                    return {
                        day,
                        symbol,
                        opened,
                        shouldNotify,
                        onOpenLore() {
                            loreTitle.value = unref(layers[layer ?? "trees"]?.name ?? "");
                            loreBody.value = story;
                        },
                        onOpenLayer() {
                            if (player.tabs.includes(layer ?? "trees")) {
                                const index = player.tabs.lastIndexOf(layer ?? "trees");
                                player.tabs.splice(index, 1);
                            } else {
                                player.tabs.push(layer ?? "trees");
                            }
                        },
                        onUnlockLayer() {
                            opened.value = true;
                            setTimeout(() => {
                                loreTitle.value = unref(layers[layer ?? "trees"]?.name ?? "");
                                loreBody.value = story;
                            }, 1000);
                        }
                    };
                }
            };
        });
    }

    const days = [
        createDay(() => ({
            day: 1,
            shouldNotify: false,
            layer: null,
            symbol: "🎄",
            story: "Oh no! Santa forgot about Christmas and it's only 25 days away! He's asked for your help due to your history getting large quantities of things in short amounts of time. Unfortunately you're really starting from scratch here - let's start with getting wood, which you'll need for everything from building workshops to wrapping paper to many of the toys themselves!"
        })),
        createDay(() => ({
            day: 2,
            shouldNotify: false,
            layer: null,
            symbol: "<span class='material-icons'>cabin</span>",
            story: "Santa looked over your tree farm and was impressed with how much you could accomplish in just one day. Today's goal is to get a workshop built up for the elves to work in - and apparently, they need quite a lot of space to work!"
        })),
        createDay(() => ({
            day: 3,
            shouldNotify: false,
            layer: null,
            symbol: "🧝",
            story: "With this unbelievably large workshop complete, it's time to get the elves to work! But it appears they've forgotten how to make toys over the last 11 months - guess it's time to setup training sessions!"
        })),
        createDay(() => ({
            day: 4,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 5,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 6,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 7,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 8,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 9,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 10,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 11,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 12,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 13,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 14,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 15,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 16,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 17,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 18,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 19,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 20,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 21,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 22,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 23,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        })),
        createDay(() => ({
            day: 24,
            shouldNotify: false,
            layer: null,
            symbol: "",
            story: ""
        }))
    ];

    return {
        name: "Calendar",
        days,
        day,
        loreTitle,
        loreBody,
        minWidth: 710,
        display: jsx(() => (
            <>
                {player.devSpeed === 0 ? <div>Game Paused</div> : null}
                {player.devSpeed && player.devSpeed !== 1 ? (
                    <div>Dev Speed: {format(player.devSpeed)}x</div>
                ) : null}
                {player.offlineTime ? (
                    <div>Offline Time: {formatTime(player.offlineTime)}</div>
                ) : null}
                <Spacer />
                <div class="advent">
                    {days
                        .reduce(
                            (acc, curr) => {
                                if (acc[acc.length - 1].length === 4) {
                                    acc.push([]);
                                }
                                acc[acc.length - 1].push(curr);
                                return acc;
                            },
                            [[]] as Day[][]
                        )
                        .map(days => renderRow(...days))}
                </div>
            </>
        ))
    };
});

/**
 * Given a player save data object being loaded, return a list of layers that should currently be enabled.
 * If your project does not use dynamic layers, this should just return all layers.
 */
export const getInitialLayers = (
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    player: Partial<PlayerData>
): Array<GenericLayer> => [main, trees];

/**
 * A computed ref whose value is true whenever the game is over.
 */
export const hasWon = computed(() => {
    return false;
});

/**
 * Given a player save data object being loaded with a different version, update the save data object to match the structure of the current version.
 * @param oldVersion The version of the save being loaded in
 * @param player The save data being loaded in
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function fixOldSave(
    oldVersion: string | undefined,
    player: Partial<PlayerData>
    // eslint-disable-next-line @typescript-eslint/no-empty-function
): void {}
/* eslint-enable @typescript-eslint/no-unused-vars */
