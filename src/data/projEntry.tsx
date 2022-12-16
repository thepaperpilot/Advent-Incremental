import Spacer from "components/layout/Spacer.vue";
import {
    CoercableComponent,
    Component,
    GatherProps,
    GenericComponent,
    jsx
} from "features/feature";
import { BaseLayer, createLayer, GenericLayer, layers } from "game/layers";
import { Persistent, persistent } from "game/persistence";
import type { LayerData, PlayerData } from "game/player";
import player from "game/player";
import Decimal, { format, formatTime } from "util/bignum";
import { Computable, convertComputable, ProcessedComputable } from "util/computed";
import { createLazyProxy } from "util/proxies";
import { save } from "util/save";
import { renderRow, VueFeature } from "util/vue";
import type { Ref } from "vue";
import { computed, ref, unref } from "vue";
import "./advent.css";
import Day from "./Day.vue";
import boxesSymbol from "./symbols/cardboardBox.png";
import clothSymbol from "./symbols/cloth.png";
import coalSymbol from "./symbols/coal.png";
import dyesSymbol from "./symbols/dyes.png";
import elfSymbol from "./symbols/elf.png";
import managementSymbol from "./symbols/elfManagement.png";
import lettersSymbol from "./symbols/letterbox.png";
import metalSymbol from "./symbols/metal.png";
import oilSymbol from "./symbols/oil.png";
import paperSymbol from "./symbols/paperStacks.png";
import plasticSymbol from "./symbols/plastic.png";
import workshopSymbol from "./symbols/sws.png";
import treeSymbol from "./symbols/tree.png";
import advManagementSymbol from "./symbols/workshopMansion.png";
import wrappingPaperSymbol from "./symbols/wrappingPaper.png";
import ribbonsSymbol from "./symbols/ribbons.png";
import coal from "./layers/coal";
import elves from "./layers/elves";
import trees from "./layers/trees";
import workshop from "./layers/workshop";
import paper from "./layers/paper";
import boxes from "./layers/boxes";
import metal from "./layers/metal";
import cloth from "./layers/cloth";
import oil from "./layers/oil";
import plastic from "./layers/plastic";
import dyes from "./layers/dyes";
import letters from "./layers/letters";
import management from "./layers/management";
import wrappingPaper from "./layers/wrapping-paper";

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

    const swappingMastery = ref(false);
    const isMastery = persistent<boolean>(false);
    const toggleMastery = () => {
        swappingMastery.value = true;
        isMastery.value = !isMastery.value;

        for (const layer of [
            trees,
            workshop,
            coal,
            // elves,
            // paper,
            // boxes,
            // metal,
            // cloth,
            // oil,
            // plastic,
            // dyes,
            // management,
            // letters
        ]) { layer.swapMastery() }

        swappingMastery.value = false;
    };

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
                        mastered: (layers[layer ?? ""] as any)?.mastered ?? ref(false),
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
                            layers[layer ?? "trees"]!.minimized.value = false;
                        },
                        onUnlockLayer() {
                            if (layer) {
                                opened.value = true;
                                setTimeout(() => {
                                    loreScene.value = -1;
                                    loreTitle.value = unref(layers[layer ?? "trees"]?.name ?? "");
                                    loreBody.value = story;
                                    if (player.autoPause) player.devSpeed = null;
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
            layer: "plastic",
            symbol: plasticSymbol,
            story: "Now that plenty of oil has been prepared, it's time to start refining it into plastic! This should be incredibly useful not only for toys, but making tools and other items!",
            completedStory:
                "You've started refining massive amounts of oil into slightly less massive amounts of plastic. You have a slight pang of regret thinking of the environmental impact, but ultimately decide Christmas is worth it. Good Job!"
        })),
        createDay(() => ({
            day: 11,
            shouldNotify: false,
            layer: "dyes",
            symbol: dyesSymbol,
            story: "To make toys, we're going to need some color to make them look nice and enticing! We can't just give kids clear toys after all! To add some color to our toys, we'll need some dyes!",
            completedStory:
                "After all that effort, you finally have a rainbow of dyes to choose from! Now the children won't be able to resist the toys you have to offer, once you get them made of course... Good Job!"
        })),
        createDay(() => ({
            day: 12,
            shouldNotify: false,
            layer: "management",
            symbol: managementSymbol,
            story: "You watch as the elves work, and you realize that they could probably be trained to help out better. Just then, Santa comes over to check on your progress. You reply that you're doing fine, except that the elves may need a bit of behavior management. Santa offers to help, saying that he doesn't want to leave you to do everything. Unfortunately for you, the behavior problems won't fix themselves, so let's get to work!",
            completedStory:
                "Woo! You are exhausted - this layer felt really long to you. It's great seeing the elves so productive, although you worry a bit about your own job security now! Good Job!"
        })),
        createDay(() => ({
            day: 13,
            shouldNotify: false,
            layer: "management",
            symbol: advManagementSymbol,
            story: "So after a good night's rest you decide that maybe making these elves able to do all the work for you isn't something to be scared of, but rather encouraged. Let's spend another day continuing to train them up and really get this place spinning. They are Santa's elves after all, they're supposed to be able to run everything without you!",
            completedStory:
                "The elves are doing an incredible job, and Santa does not seem keen on firing you - Score! Now you can get to work on guiding this properly trained highly functional group of hard workers to make Christmas as great as possible. Good Job!"
        })),
        createDay(() => ({
            day: 14,
            shouldNotify: false,
            layer: "letters",
            symbol: lettersSymbol,
            story: "Fully prepared to start working on presents, you realize you don't actually know what to make! You ask Santa and he points at a massive pile of letters hiding just off-camera. Those are all the letters to Santa that need to be processed, sorted, and categorized appropriately so every kid gets what they need!",
            completedStory:
                "The letters are sorted! You have a slight feeling you may have rushed a little, and suddenly understand why sometimes you don't get everything you asked Santa for every year, or even the occasional bad gift. You sympathetically pat Santa on the back as you head to bed for the day. Good Job!"
        })),
        createDay(() => ({
            day: 15,
            shouldNotify: false,
            layer: "wrappingPaper",
            symbol: wrappingPaperSymbol,
            story: "You'll need to produce wrapping paper so the presents can be wrapped. The elves are getting a bit bored of their boring old workstations, so you decide to let them decorate with some wrapping paper.",
            completedStory:
                "You've produced enough wrapping paper, and the elves are happy with their new workstations. However, some will need more than just wrapping paper to decorate."
        })),
        createDay(() => ({
            day: 16,
            shouldNotify: false,
            layer: null, // "ribbons"
            symbol: ribbonsSymbol,
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
        if (player.autoPause) player.devSpeed = 0;
        save();
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
        isMastery,
        toggleMastery,
        swappingMastery,
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
): Array<GenericLayer> => [
    main,
    trees,
    workshop,
    coal,
    elves,
    paper,
    boxes,
    metal,
    cloth,
    oil,
    plastic,
    dyes,
    wrappingPaper,
    management,
    letters
];

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
    if (!["0.0", "0.1", "0.2", "0.3", "0.4"].includes(oldVersion ?? "")) {
        return;
    }
    if ((player.layers?.workshop as LayerData<typeof workshop> | undefined)?.foundationProgress) {
        (player.layers?.workshop as LayerData<typeof workshop> | undefined)!.foundationProgress =
            Decimal.min(
                (player.layers!.workshop as LayerData<typeof workshop> | undefined)!
                    .foundationProgress!,
                1000
            );
    }
    /*player.offlineProd = false;
    delete player.layers?.management;
    if ((player.layers?.main as LayerData<typeof main> | undefined)?.days?.[11]) {
        (player.layers!.main as LayerData<typeof main>).days![11].opened = false;
    }
    if ((player.layers?.main as LayerData<typeof main> | undefined)?.day === 12) {
        (player.layers!.main as LayerData<typeof main>).day === 11;
        player.devSpeed = 0;
    }
    if (player.tabs) {
        player.tabs = player.tabs.filter(l => l !== "management");
    }*/
}
/* eslint-enable @typescript-eslint/no-unused-vars */
