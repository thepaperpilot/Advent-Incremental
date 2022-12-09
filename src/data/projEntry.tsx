import Spacer from "components/layout/Spacer.vue";
import {
    CoercableComponent,
    Component,
    GatherProps,
    GenericComponent,
    jsx
} from "features/feature";
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
import workshop from "./layers/workshop";
import treeSymbol from "./symbols/tree.png";
import workshopSymbol from "./symbols/sws.png";
import coalSymbol from "./symbols/coal.png";
import elfSymbol from "./symbols/elf.png";
import paperSymbol from "./symbols/paperStacks.png";
import boxesSymbol from "./symbols/cardboardBox.png";
import metalSymbol from "./symbols/metal.png";
import clothSymbol from "./symbols/cloth.png";
import oilSymbol from "./symbols/oil.png";
import coal from "./layers/coal";
import elves from "./layers/elves";
import paper from "./layers/paper";
import boxes from "./layers/boxes";
import metal from "./layers/metal";
import cloth from "./layers/cloth";
import oil from "./layers/oil";

export interface Day extends VueFeature {
    day: number;
    layer: string | null;
    symbol: string;
    story: string;
    completedStory: string;
    opened: Ref<boolean>;
    recentlyUpdated: Ref<boolean>; // Has the tab recieved an update since the player last opened it?
    shouldNotify: ProcessedComputable<boolean>;
}

export const main = createLayer("main", function (this: BaseLayer) {
    const day = persistent<number>(1);
    const timeUntilNewDay = computed(
        () => (+new Date(new Date().getFullYear(), 11, day.value) - player.time) / 1000
    );

    const showLoreModal = ref<boolean>(false);
    const loreScene = ref<number>(-1);
    const loreTitle = ref<string>("");
    const loreBody = ref<CoercableComponent | undefined>();

    function createDay(
        optionsFunc: () => {
            day: number;
            shouldNotify: Computable<boolean>;
            layer: string | null;
            symbol: string;
            story: string;
            completedStory: string;
        }
    ): Day {
        const opened = persistent<boolean>(false);
        const recentlyUpdated = persistent<boolean>(false);

        return createLazyProxy(() => {
            const day = optionsFunc();

            const optionsShouldNotify = convertComputable(day.shouldNotify);
            const shouldNotify = convertComputable(
                () => unref(optionsShouldNotify) || unref(recentlyUpdated)
            );

            return {
                ...day,
                opened,
                shouldNotify,
                recentlyUpdated,
                [Component]: Day as GenericComponent,
                [GatherProps]: function (this: Day) {
                    const {
                        day,
                        layer,
                        symbol,
                        opened,
                        shouldNotify,
                        story,
                        completedStory,
                        recentlyUpdated
                    } = this;

                    return {
                        day,
                        symbol,
                        layer,
                        opened,
                        recentlyUpdated,
                        shouldNotify,
                        onOpenLore() {
                            const completed = main.day.value > day;
                            loreScene.value = completed ? day - 1 : -1;
                            const title = unref(layers[layer ?? "trees"]?.name ?? "");
                            loreTitle.value = completed ? `${title} - Completed!` : title;
                            loreBody.value = completed
                                ? `${story}<hr style="
                            margin: 10px 0;"/>${completedStory}`
                                : story;
                            showLoreModal.value = true;
                        },
                        onOpenLayer() {
                            recentlyUpdated.value = false;
                            // 1468 is because two tabs with minWidth of 700px plus the minimized calendar of 60px plus 2 dividers of 4px each
                            if (window.matchMedia("(min-width: 1468px)").matches) {
                                // Desktop, allow multiple tabs to be open
                                if (player.tabs.includes(layer ?? "trees")) {
                                    const index = player.tabs.lastIndexOf(layer ?? "trees");
                                    player.tabs.splice(index, 1);
                                } else {
                                    player.tabs.push(layer ?? "trees");
                                    main.minimized.value = true;
                                }
                            } else {
                                // Mobile, use single tab mode
                                player.tabs.splice(1, Infinity, layer ?? "trees");
                            }
                        },
                        onUnlockLayer() {
                            if (layer) {
                                opened.value = true;
                                setTimeout(() => {
                                    loreScene.value = -1;
                                    loreTitle.value = unref(layers[layer ?? "trees"]?.name ?? "");
                                    loreBody.value = story;
                                    player.devSpeed = null;
                                    showLoreModal.value = true;
                                }, 1000);
                            }
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
            layer: "trees",
            symbol: treeSymbol,
            story: "Oh no! Santa forgot about Christmas and it's only 25 days away! He's asked for your help due to your history getting large quantities of things in short amounts of time. Unfortunately you're really starting from scratch here - let's start with getting wood, which you'll need for everything from building workshops to wrapping paper to many of the toys themselves!",
            completedStory:
                "Santa looks at all the wood you've gathered and tells you you've done well! He says you should take the rest of the day off so you're refreshed for tomorrow's work. Good Job!"
        })),
        createDay(() => ({
            day: 2,
            shouldNotify: false,
            layer: "workshop",
            symbol: workshopSymbol,
            story: "Santa looked over your tree farm and was impressed with how much you could accomplish in just one day. Today's goal is to get a workshop built up for the elves to work in - and apparently, they need quite a lot of space to work!",
            completedStory:
                "The workshop complete, Santa once again dismisses you for the day. With a strong foundation, this workshop should suffice for supporting future work toward this impossible mission. Good Job!"
        })),
        createDay(() => ({
            day: 3,
            shouldNotify: false,
            layer: "coal",
            symbol: coalSymbol,
            story: "Santa tells you that unfortunately there are quite a few naughty children out there this year, and he's going to need you to gather as much coal as you can for him to give out.",
            completedStory:
                "Santa looks at all the coal you've gathered and tells you you've done well! He says you should take the rest of the day off so you're refreshed for tomorrow's work. Good Job!"
        })),
        createDay(() => ({
            day: 4,
            shouldNotify: false,
            layer: "elves",
            symbol: elfSymbol,
            story: "Alright, it seems you finally have enough things set up to start bringing in the elves! Unfortunately, it seems they'll need to be retrained on how to help, since they've stopped practicing for 11 months!",
            completedStory:
                "The workshop now hums with the bustling elves working on everything. They can take it from here - you deserve a break after such a long day! Good Job!"
        })),
        createDay(() => ({
            day: 5,
            shouldNotify: false,
            layer: "paper",
            symbol: paperSymbol,
            story: "With the elves trained, we're almost ready to start working on these presents! Just a couple more pre-reqs first, starting with turning all this wood into wood pulp and finally into paper, which will be required for wrapping paper later on but in the meantime can be used to help write guides which will help these elves continue their education!",
            completedStory:
                "You look upon your rivers of book pulp as you hand out stacks of papers to elves to read through. You've continued getting closer and closer to preparing for Christmas, and can go to bed satisfied with your progress. Good Job!"
        })),
        createDay(() => ({
            day: 6,
            shouldNotify: false,
            layer: "boxes",
            symbol: boxesSymbol,
            story: "You watch all these elves carrying incredibly large loads just in their open elf-sized hands, and realize there's probably a better way. You need to put the toys in boxes anyways, so why don't we get started working on those so the workers can take advantage as well?",
            completedStory:
                "Wow, those boxes are really convenient! The workshop feels more and more proper with every day. You tick another requirement on your list and start looking towards tomorrow. Good Job!"
        })),
        createDay(() => ({
            day: 7,
            shouldNotify: false,
            layer: "metal",
            symbol: metalSymbol,
            story: "You woke up ready to make some toys, before realizing most toys these days are made out of more than just wood! You're sure you're close to really getting to work, but there's a few more materials you're going to need - like metal! Lots of things need metal!",
            completedStory:
                "The sounds of drills and metal clanging join the already loud din as yet another piece of the puzzle fits into place. You're making solid progress, Good Job!"
        })),
        createDay(() => ({
            day: 8,
            shouldNotify: false,
            layer: "cloth",
            symbol: clothSymbol,
            story: "Another resource you're going to need for gifts is cloth! Fortunately you think this should be pretty easy to prepare using a sheep farm - and as you've already proven with the tree farm, that's something you can handle!",
            completedStory:
                "You fall into a pile of wool, sighing contentedly as you look at all the progress you've made today. Good Job!"
        })),
        createDay(() => ({
            day: 9,
            shouldNotify: false,
            layer: "oil",
            symbol: oilSymbol,
            story: "Looks like you just need one more thing before the toy factory can start running: plastic! Every toy nowadays is made with plastic! But wait, how are you going to get plastic? What can make plastic? Wait that's right, oil! You figured out you might as well repurpose your coal and ore drills into something that can get you oil, but unfortunately you'll need to mine much deeper that you're currently doing, so let's get to work!",
            completedStory:
                "It took a while, but you finally got enough oil for the next step! You deserve a good rest after all this digging work - tomorrow will be a busy day! Good Job!"
        })),
        createDay(() => ({
            day: 10,
            shouldNotify: false,
            layer: null, // "plastic"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 11,
            shouldNotify: false,
            layer: null, // "dyes"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 12,
            shouldNotify: false,
            layer: null, // "management"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 13,
            shouldNotify: false,
            layer: null, // ""
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 14,
            shouldNotify: false,
            layer: null, // ""
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 15,
            shouldNotify: false,
            layer: null, // "wrapping paper"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 16,
            shouldNotify: false,
            layer: null, // "ribbons"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 17,
            shouldNotify: false,
            layer: null, // "toys 1"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 18,
            shouldNotify: false,
            layer: null, // "toys 2"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 19,
            shouldNotify: false,
            layer: null, // "toys 3"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 20,
            shouldNotify: false,
            layer: null, // "presents"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 21,
            shouldNotify: false,
            layer: null, // "reindeer"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 22,
            shouldNotify: false,
            layer: null, // "sleigh"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 23,
            shouldNotify: false,
            layer: null, // "distribution route planning"
            symbol: "",
            story: "",
            completedStory: ""
        })),
        createDay(() => ({
            day: 24,
            shouldNotify: false,
            layer: null, // "packing the presents"
            symbol: "",
            story: "",
            completedStory: ""
        }))
    ];

    function completeDay() {
        loreScene.value = day.value - 1;
        loreTitle.value = "Day Complete!";
        loreBody.value = days[day.value - 1].completedStory;
        showLoreModal.value = true;
        day.value++;
        main.minimized.value = false;
        player.devSpeed = 0;
    }

    return {
        name: "Calendar",
        days,
        day,
        timeUntilNewDay,
        loreScene,
        loreTitle,
        loreBody,
        showLoreModal,
        completeDay,
        minWidth: 700,
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
                        .map((days: Day[]) => renderRow(...days))}
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
): Array<GenericLayer> => [main, trees, workshop, coal, elves, paper, boxes, metal, cloth, oil];

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
): void {
    player.offlineProd = false;
}
/* eslint-enable @typescript-eslint/no-unused-vars */
