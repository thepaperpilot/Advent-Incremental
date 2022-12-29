import Spacer from "components/layout/Spacer.vue";
import {
    CoercableComponent,
    Component,
    GatherProps,
    GenericComponent,
    jsx,
    Visibility
} from "features/feature";
import { createParticles } from "features/particles/particles";
import { BaseLayer, createLayer, GenericLayer, layers } from "game/layers";
import { isPersistent, Persistent, persistent } from "game/persistence";
import type { Player } from "game/player";
import player from "game/player";
import { format, formatTime } from "util/bignum";
import { Computable, convertComputable, ProcessedComputable } from "util/computed";
import { createLazyProxy, Proxied, ProxyState } from "util/proxies";
import { save } from "util/save";
import { render, renderRow, VueFeature } from "util/vue";
import { computed, isReadonly, isRef, Ref, ref, unref, watchEffect } from "vue";
import "./advent.css";
import { credits } from "./credits";
import Day from "./Day.vue";
import boxes from "./layers/boxes";
import cloth from "./layers/cloth";
import coal from "./layers/coal";
import dyes from "./layers/dyes";
import elves from "./layers/elves";
import factory from "./layers/factory";
import presentSymbol from "./layers/factory-components/present.svg";
import letters from "./layers/letters";
import management from "./layers/management";
import metal from "./layers/metal";
import oil from "./layers/oil";
import packing from "./layers/packing";
import paper from "./layers/paper";
import plastic from "./layers/plastic";
import reindeer from "./layers/reindeer";
import ribbon from "./layers/ribbon";
import routing from "./layers/routing";
import sleigh from "./layers/sleigh";
import toys from "./layers/toys";
import trees from "./layers/trees";
import workshop from "./layers/workshop";
import wrappingPaper from "./layers/wrapping-paper";
import boxesSymbol from "./symbols/cardboardBox.png";
import clothSymbol from "./symbols/cloth.png";
import coalSymbol from "./symbols/coal.png";
import dyesSymbol from "./symbols/dyes.png";
import elfSymbol from "./symbols/elf.png";
import managementSymbol from "./symbols/elfManagement.png";
import factorySymbol from "./symbols/gears.png";
import routingSymbol from "./symbols/gps.png";
import lettersSymbol from "./symbols/letterbox.png";
import metalSymbol from "./symbols/metal.png";
import oilSymbol from "./symbols/oil.png";
import paperSymbol from "./symbols/paperStacks.png";
import plasticSymbol from "./symbols/plastic.png";
import presentsSymbol from "./symbols/presents.png";
import reindeerSymbol from "./symbols/reindeer.png";
import ribbonsSymbol from "./symbols/ribbons.png";
import packingSymbol from "./symbols/santasSack.png";
import sleighSymbol from "./symbols/sleigh.png";
import snowflakeSymbol from "./symbols/snowflake.svg";
import workshopSymbol from "./symbols/sws.png";
import advFactorySymbol from "./symbols/teddyBear.png";
import treeSymbol from "./symbols/tree.png";
import toysSymbol from "./symbols/truck.png";
import advManagementSymbol from "./symbols/workshopMansion.png";
import wrappingPaperSymbol from "./symbols/wrappingPaper.png";

export interface Day extends VueFeature {
    day: number;
    layer: string | null;
    symbol: string;
    story: string;
    completedStory: string;
    masteredStory: string;
    opened: Persistent<boolean>;
    recentlyUpdated: Ref<boolean>; // Has the tab recieved an update since the player last opened it?
    shouldNotify: ProcessedComputable<boolean>;
    visibility?: Visibility;
}

export const main = createLayer("main", function (this: BaseLayer) {
    const day = persistent<number>(1);
    const hasWon = persistent<boolean>(false);

    const timeUntilNewDay = computed(
        () => (+new Date(new Date().getFullYear(), 11, day.value) - player.time) / 1000
    );

    const showLoreModal = ref<boolean>(false);
    const loreScene = ref<number>(-1);
    const loreTitle = ref<string>("");
    const loreBody = ref<CoercableComponent | undefined>();

    const creditsOpen = ref<boolean>(false);

    // I don't understand how this works
    const particles = createParticles(() => ({
        boundingRect: ref<null | DOMRect>(null),
        onContainerResized(boundingRect) {
            this.boundingRect.value = boundingRect;
        },
        style: "z-index: -1"
    }));

    const emitter = particles.addEmitter({
        emit: false,
        autoUpdate: true,
        lifetime: { min: 10, max: 10 },
        emitterLifetime: -1,
        pos: { x: 0, y: 0 },
        frequency: 0.05,
        maxParticles: 1000,
        behaviors: [
            {
                type: "alphaStatic",
                config: {
                    alpha: 1
                }
            },
            {
                type: "scaleStatic",
                config: {
                    min: 1,
                    max: 1
                }
            },
            {
                type: "moveSpeed",
                config: {
                    speed: {
                        list: [
                            {
                                value: 200,
                                time: 0
                            },
                            {
                                value: 100,
                                time: 1
                            }
                        ],
                        isStepped: false
                    }
                }
            },
            {
                type: "rotationStatic",
                config: {
                    min: 70,
                    max: 110
                }
            },
            {
                type: "spawnShape",
                config: {
                    type: "rect",
                    data: {
                        x: 0,
                        y: 0,
                        w: 1600,
                        h: 1
                    }
                }
            },
            {
                type: "textureSingle",
                config: {
                    texture: snowflakeSymbol
                }
            }
        ]
    });

    watchEffect(() => {
        const shouldEmit = day.value === 25;
        emitter.then(e => (e.emit = shouldEmit));
    });

    const currentlyMastering = computed(() =>
        isMastery.value
            ? Object.values(layers).find(
                  layer =>
                      unref((layer as any).mastered) === false &&
                      !["Elves", "Management"].includes(unref(layer?.name ?? ""))
              )
            : undefined
    );
    const swappingMastery = ref(false);
    const isMastery = persistent<boolean>(false);
    const toggleMastery = () => {
        swappingMastery.value = true;
        isMastery.value = !isMastery.value;

        for (const layer of [
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
            management,
            letters
        ]) {
            swapMastery(layer.mastery, (layer as unknown as Proxied<GenericLayer>)[ProxyState]);
        }

        swappingMastery.value = false;
    };
    function swapMastery(mastery: Record<string, any>, layer: Record<string, any>) {
        for (const key of Object.keys(mastery)) {
            if (isPersistent(mastery[key])) {
                if (!isRef(layer[key]) || isReadonly(layer[key])) {
                    console.error("Something went wrong swapping state", key, layer, mastery);
                    continue;
                }
                [mastery[key].value, layer[key].value] = [layer[key].value, mastery[key].value];
            } else {
                swapMastery(mastery[key], layer[key]);
            }
        }
    }

    const masteredDays = computed(() => {
        let index = Object.values(layers)
            .filter(l => l && "mastered" in l)
            .findIndex(l => (l as any).mastered.value === false);
        if (index === -1) {
            index = Object.values(layers).filter(l => l && "mastered" in l).length;
        }
        return index;
    });

    function openDay(layer: string) {
        // 1468 is because two tabs with minWidth of 700px plus the minimized calendar of 60px plus 2 dividers of 4px each
        if (window.matchMedia("(min-width: 1468px)").matches) {
            // Desktop, allow multiple tabs to be open
            if (player.tabs.includes(layer)) {
                const index = player.tabs.lastIndexOf(layer);
                player.tabs.splice(index, 1);
            } else {
                player.tabs.push(layer);
                main.minimized.value = true;
            }
        } else {
            // Mobile, use single tab mode
            player.tabs.splice(1, Infinity, layer);
        }
        layers[layer]!.minimized.value = false;
    }

    function createDay(
        optionsFunc: () => {
            day: number;
            shouldNotify: Computable<boolean>;
            layer: string | null;
            symbol: string;
            story: string;
            completedStory: string;
            masteredStory: string;
            visibility?: Visibility;
        }
    ): Day {
        const opened = persistent<boolean>(false);
        const recentlyUpdated = persistent<boolean>(false);

        return createLazyProxy(() => {
            const day = optionsFunc();

            const optionsShouldNotify = convertComputable(day.shouldNotify);
            const shouldNotify = computed(
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
                        masteredStory,
                        recentlyUpdated,
                        visibility
                    } = this;

                    const mastered: Ref<boolean> =
                        (layers[layer ?? ""] as any)?.mastered ?? ref(false);
                    return {
                        day,
                        symbol,
                        layer,
                        opened,
                        recentlyUpdated,
                        shouldNotify,
                        mastered,
                        visibility,
                        onOpenLore() {
                            const completed = main.day.value > day;
                            loreScene.value = completed ? day - 1 : -1;
                            const title = unref(layers[layer ?? "trees"]?.name ?? "");
                            loreTitle.value = mastered.value
                                ? `${title} - Decorated!`
                                : completed
                                ? `${title} - Completed!`
                                : title;
                            loreBody.value = completed
                                ? unref(mastered)
                                    ? `${story}<hr style="
                                margin: 10px 0;"/>${completedStory}<hr style="
                                margin: 10px 0;"/>${masteredStory}`
                                    : `${story}<hr style="
                            margin: 10px 0;"/>${completedStory}`
                                : story;
                            showLoreModal.value = true;
                        },
                        onOpenLayer() {
                            if (day == 25) return;
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
                            if (layer != null || day == 25) {
                                opened.value = true;
                                setTimeout(() => {
                                    loreScene.value = -1;
                                    loreTitle.value =
                                        day == 25
                                            ? "The End!"
                                            : unref(layers[layer ?? "trees"]?.name ?? "");
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
                "Santa looks at all the wood you've gathered and tells you you've done well! He says you should take the rest of the day off so you're refreshed for tomorrow's work. Good Job!",
            masteredStory:
                "As you repeat the basic actions again, you feel like you've learned something that you didn't know the first time around. Santa is impressed at your new knowledge and inspires you to attempt this with more jobs. Great Job!"
        })),
        createDay(() => ({
            day: 2,
            shouldNotify: false,
            layer: "workshop",
            symbol: workshopSymbol,
            story: "Santa looked over your tree farm and was impressed with how much you could accomplish in just one day. Today's goal is to get a workshop built up for the elves to work in - and apparently, they need quite a lot of space to work!",
            completedStory:
                "The workshop complete, Santa once again dismisses you for the day. With a strong foundation, this workshop should suffice for supporting future work toward this impossible mission. Good Job!",
            masteredStory:
                "As you attempt to build the workshop again with your newfound experiences and resources, you realize you could have built the workshop a little bit better. As you keep building and building, you realize that you could've built it without wasting any resources. Great Job!"
        })),
        createDay(() => ({
            day: 3,
            shouldNotify: false,
            layer: "coal",
            symbol: coalSymbol,
            story: "Santa tells you that unfortunately there are quite a few naughty children out there this year, and he's going to need you to gather as much coal as you can for him to give out.",
            completedStory:
                "Santa looks at all the coal you've gathered and tells you you've done well! He says you should take the rest of the day off so you're refreshed for tomorrow's work. Good Job!",
            masteredStory:
                "It's another typical day, attempting to redo your work again, but this time for coal. While doing this tedious task, an elf comes up to you. It gives you a improved blueprint on how to make small fires. You try it, and you realize that it's a lot more efficent than your old buildings designs. You thank the elf, and resume your work. Great Job!"
        })),
        createDay(() => ({
            day: 4,
            shouldNotify: false,
            layer: "elves",
            symbol: elfSymbol,
            story: "Alright, it seems you finally have enough things set up to start bringing in the elves! Unfortunately, it seems they'll need to be retrained on how to help, since they've stopped practicing for 11 months!",
            completedStory:
                "The workshop now hums with the bustling elves working on everything. They can take it from here - you deserve a break after such a long day! Good Job!",
            masteredStory:
                "This place feels a lot more better, with less naughty elves who are more excited than ever before to do something! As you collapse into a chair thinking of all of your hard work, Santa comes by yet again to congratulate you on your hard work. You feel a pang of jealousy as Santa is taking all the credit for your work, but you decide that saving Christmas is worth it. Great Job!"
        })),
        createDay(() => ({
            day: 5,
            shouldNotify: false,
            layer: "paper",
            symbol: paperSymbol,
            story: "With the elves trained, we're almost ready to start working on these presents! Just a couple more pre-reqs first, starting with turning all this wood into wood pulp and finally into paper, which will be required for wrapping paper later on but in the meantime can be used to help write guides which will help these elves continue their education!",
            completedStory:
                "You look upon your rivers of book pulp as you hand out stacks of papers to elves to read through. You've continued getting closer and closer to preparing for Christmas, and can go to bed satisfied with your progress. Good Job!",
            masteredStory:
                "Paper. Who knew it could be so versatile? As you slowly but surely improve your skills on making paper, you find more efficent ways to make it, and as a bonus, it's also environmentally friendly (which kinda makes up for you chopping a bit too many trees)! As you pass this information along to Santa's elves, they become more excited. Great Job!"
        })),
        createDay(() => ({
            day: 6,
            shouldNotify: false,
            layer: "boxes",
            symbol: boxesSymbol,
            story: "You watch all these elves carrying incredibly large loads just in their open elf-sized hands, and realize there's probably a better way. You need to put the toys in boxes anyways, so why don't we get started working on those so the workers can take advantage as well?",
            completedStory:
                "Wow, those boxes are really convenient! The workshop feels more and more proper with every day. You tick another requirement on your list and start looking towards tomorrow. Good Job!",
            masteredStory:
                "You look at your massive amounts of boxes, but something doesn't feel right. Oh wait, the elves are only filling the boxes to half the amount that it can actually store! As realisation hits you on how you can make boxes more efficent by using simple methods, you realize that you ought to teach the art of dumping-more-stuff-in-boxes-also-known-as-hoarding to the elves. Whew, that was a lot of work. Great Job!"
        })),
        createDay(() => ({
            day: 7,
            shouldNotify: false,
            layer: "metal",
            symbol: metalSymbol,
            story: "You woke up ready to make some toys, before realizing most toys these days are made out of more than just wood! You're sure you're close to really getting to work, but there's a few more materials you're going to need - like metal! Lots of things need metal!",
            completedStory:
                "The sounds of drills and metal clanging join the already loud din as yet another piece of the puzzle fits into place. You're making solid progress, Good Job!",
            masteredStory:
                "Cling clang clang clang. The sounds of even more drills hit your ears. As you fondly look back at the terrific work you've done, you become more motivated to work harder. Just then, Santa appears in front of you and you scream. He says, \"I see you're working hard. I suggest that you take a break.\" You thank Santa for the break, sit in a chair made by the elves as a gift, and relax. Great Job!"
        })),
        createDay(() => ({
            day: 8,
            shouldNotify: false,
            layer: "cloth",
            symbol: clothSymbol,
            story: "Another resource you're going to need for gifts is cloth! Fortunately you think this should be pretty easy to prepare using a sheep farm - and as you've already proven with the tree farm, that's something you can handle!",
            completedStory:
                "You fall into a pile of wool, sighing contentedly as you look at all the progress you've made today. Good Job!",
            masteredStory:
                "You're able to bundle yourself in layer after layer of clothing. You watch as everything happens together, harmoniously. Great Job!"
        })),
        createDay(() => ({
            day: 9,
            shouldNotify: false,
            layer: "oil",
            symbol: oilSymbol,
            story: "Looks like you just need one more thing before the toy factory can start running: plastic! Every toy nowadays is made with plastic! But wait, how are you going to get plastic? What can make plastic? Wait that's right, oil! You figured out you might as well repurpose your coal and ore drills into something that can get you oil, but unfortunately you'll need to mine much deeper that you're currently doing, so let's get to work!",
            completedStory:
                "It took a while, but you finally got enough oil for the next step! You deserve a good rest after all this digging work - tomorrow will be a busy day! Good Job!",
            masteredStory:
                "Oil shoots into the air like never before. Physics itself seems to be broken, as there's no other explanation for how you can make everything perfectly efficient without any kind of loss whatsoever. But to be fair, there's probably already a bit of physics shenanigans going on in a typical Christmas anyways. Great Job!"
        })),
        createDay(() => ({
            day: 10,
            shouldNotify: false,
            layer: "plastic",
            symbol: plasticSymbol,
            story: "Now that plenty of oil has been prepared, it's time to start refining it into plastic! This should be incredibly useful not only for toys, but making tools and other items!",
            completedStory:
                "You've started refining massive amounts of oil into slightly less massive amounts of plastic. You have a slight pang of regret thinking of the environmental impact, but ultimately decide Christmas is worth it. Good Job!",
            masteredStory:
                "You're now making more plastic than you know what to do with. You'll be able to make so many toys with all of this! Great Job!"
        })),
        createDay(() => ({
            day: 11,
            shouldNotify: false,
            layer: "dyes",
            symbol: dyesSymbol,
            story: "To make toys, we're going to need some color to make them look nice and enticing! We can't just give kids clear toys after all! To add some color to our toys, we'll need some dyes!",
            completedStory:
                "After all that effort, you finally have a rainbow of dyes to choose from! Now the children won't be able to resist the toys you have to offer, once you get them made of course... Good Job!",
            masteredStory:
                "You remember back to when making various dyes was such a painful process, and contrast it to now where everything is trivialized and you even have more uses for all the dyes! Great Job!"
        })),
        createDay(() => ({
            day: 12,
            shouldNotify: false,
            layer: "management",
            symbol: managementSymbol,
            story: "You watch as the elves work, and you realize that they could probably be trained to help out better. Just then, Santa comes over to check on your progress. You reply that you're doing fine, except that the elves may need a bit of behavior management. Santa offers to help, saying that he doesn't want to leave you to do everything. Unfortunately for you, the behavior problems won't fix themselves, so let's get to work!",
            completedStory:
                "Woo! You are exhausted - this layer felt really long to you. It's great seeing the elves so productive, although you worry a bit about your own job security now! Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 13,
            shouldNotify: false,
            layer: "management",
            symbol: advManagementSymbol,
            story: "So after a good night's rest you decide that maybe making these elves able to do all the work for you isn't something to be scared of, but rather encouraged. Let's spend another day continuing to train them up and really get this place spinning. They are Santa's elves after all, they're supposed to be able to run everything without you!",
            completedStory:
                "The elves are doing an incredible job, and Santa does not seem keen on firing you - Score! Now you can get to work on guiding this properly trained highly functional group of hard workers to make Christmas as great as possible. Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 14,
            shouldNotify: false,
            layer: "letters",
            symbol: lettersSymbol,
            story: "Fully prepared to start working on presents, you realize you don't actually know what to make! You ask Santa and he points at a massive pile of letters hiding just off-camera. Those are all the letters to Santa that need to be processed, sorted, and categorized appropriately so every kid gets what they need!",
            completedStory:
                "The letters are sorted! You have a slight feeling you may have rushed a little, and suddenly understand why sometimes you don't get everything you asked Santa for every year, or even the occasional bad gift. You sympathetically pat Santa on the back as you head to bed for the day. Good Job!",
            masteredStory:
                "Finally, you've become the letter processing machine you always knew you could be. There's nothing anyone can do to stop you from processing every gosh darn letter to Santa there is. Great Job!"
        })),
        createDay(() => ({
            day: 15,
            shouldNotify: false,
            layer: "wrappingPaper",
            symbol: wrappingPaperSymbol,
            story: "You'll need to produce wrapping paper so the presents can be wrapped. The elves are getting a bit bored of their boring old workstations, so you decide to let them decorate with some wrapping paper.",
            completedStory:
                "You've produced enough wrapping paper, and the elves are happy with their new workstations. However, some will need more than just wrapping paper to decorate. For now, Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 16,
            shouldNotify: false,
            layer: "ribbon",
            symbol: ribbonsSymbol,
            story: "In addition to wrapping paper, you think some ribbons are in order! These should work pretty similarly, allowing you to decorate even more workstations!",
            completedStory:
                "Ribbon surrounds the north pole now - everything looks fantastic, and you're pretty sure now you have every single material you could possibly need to start making toys and preparing them for Christmas! With just under 10 days left until Christmas, you go to sleep giddy with anticipation. Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 17,
            shouldNotify: false,
            layer: "toys",
            symbol: toysSymbol,
            story: "You've had enough of this running around and stalling - it is time to create some toys NOW! You have everything you need and then some, so let's finally just sit down and get this process started!",
            completedStory:
                "In your haste you may have been a bit wasteful with resources, but it feels really good to finally make some meaningful progress on making toys for Santa. You already envision plans on how to get elves to help you out and start pumping out these toys, but for now... Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 18,
            shouldNotify: false,
            layer: "factory",
            symbol: factorySymbol,
            story: "Alright, so those toys were using incredibly large amounts of resources to make. Fortunately, you happen to have access to a group of people with an uncanny knack for making stuff without actually consuming materials - Elves! Let's turn this workshop into a proper factory, and get them producing these toys with miraculous efficiency!",
            completedStory:
                "That was a bit different than the usual elf training you are used to. But this factory seems very versatile, so you think it's a fair trade-off for needing to set things up a bit more. Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 19,
            shouldNotify: false,
            layer: "factory",
            symbol: advFactorySymbol,
            story: "Santa pulls you aside and says he thinks 3 unique toys might not be enough. You try to argue that they come in many color variations due to all the dyes you're using, but Santas insists you're going to need more. Well, suppose it's time to expand the factory!",
            completedStory:
                "Alright, admittedly 6 unique toys still feels like a bit of a compromise, but Santa seems pleased enough and with Christmas less than a week away, you're more than satisfied. Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 20,
            shouldNotify: false,
            layer: "factory",
            symbol: presentsSymbol,
            story: "Santa comes by again, and tells you that just toys may not be appealing enough. He tells you that you should probably wrap them in some wrapping paper so that it's more of a surprise. You try to argue that you've already done too much for him and deserve a day off, but Santa argues that it's for the benefit of everyone and that you'll get your vacation soon. Oh well, time to get back to the factory and expand it even more. Here we go again!",
            completedStory:
                "That was a lot of work, but it certainly felt worth actually using all those decorative supplies you'd previously made. One more sleepless night down, just a handful more to go. Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 21,
            shouldNotify: false,
            layer: "reindeer",
            symbol: reindeerSymbol,
            story: "Now that the toys are being taken care of, it's time to make sure everything is prepped for the big night. One immediate concern is the reindeer, who are going to have to be in tip-top shape. Fortunately, Santa has a recipe to a very strong vitamin-filled kibble that'll get them pumped in no time!",
            completedStory:
                "Alright, now that the reindeer have been given all their ste- vitamins, I mean, they should be prepared for Christmas. Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 22,
            shouldNotify: false,
            layer: "sleigh",
            symbol: sleighSymbol,
            story: "You realize you haven't noticed a very important object since you've started working here. Where's the sleigh? You bring it up to Santa and he immediately becomes visibly stressed, mentioning it's been in disrepair and he completely forgot! You promise you'll get it back in shape in no time!",
            completedStory:
                "Crisis averted! The sleigh has been returned to it's full splendor. Santa is incredibly appreciative. Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 23,
            shouldNotify: false,
            layer: "routing",
            symbol: routingSymbol,
            story: "You're almost ready for the big day! The next step is to find an optimal route to ensure you can get all the presents delivered before kids start waking up! This is like the travelling salesman problem on steroids. Good Luck!",
            completedStory:
                "Take that, math majors! Optimal route planned with time to spare. Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 24,
            shouldNotify: false,
            layer: "packing",
            symbol: packingSymbol,
            story: "You're almost done! The last step is to load up the sleigh with all the presents and get ready to go! You're going to need to pack a lot of presents, so you'll need to make sure you pack them tightly enough. Good Luck!",
            completedStory:
                "At last, you've crammed in all the presents Santa needs. Santa can take it from here. Good Job!",
            masteredStory: ""
        })),
        createDay(() => ({
            day: 25,
            shouldNotify: false,
            layer: null, // credits
            symbol: snowflakeSymbol,
            story: `It's Christmas. Thanks to your efforts, Santa has delivered all the presents to people all over the world. That is, all but one... <br><br> <div style='text-align: center'><img class='present-clickable' onclick ='layers.main.showLoreModal.value = false; layers.main.creditsOpen.value = true' src='${presentSymbol}' /><br>Open your present</div><br/>`,
            completedStory: "",
            masteredStory: "",
            visibility: Visibility.None
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

    function completeMastery() {
        const completedLayer = currentlyMastering.value;
        if (completedLayer == null) {
            return;
        }
        loreScene.value = (completedLayer as any).day - 1;
        loreTitle.value = "Day Decorated!";
        loreBody.value = days[loreScene.value].masteredStory;
        showLoreModal.value = true;
        if ((completedLayer as any).mastered != null) {
            (completedLayer as any).mastered.value = true;
        }
        toggleMastery();
        if (completedLayer.id === "cloth") {
            elves.elves.plasticElf.bought.value = true;
        }
    }

    watchEffect(() => {
        if (day.value === 25 && showLoreModal.value === false && !hasWon.value) {
            loreScene.value = -1;
            loreTitle.value = "Merry Christmas!";
            loreBody.value = days[day.value - 1].story;
            showLoreModal.value = true;
            hasWon.value = true;
        }
    });

    return {
        name: "Calendar",
        days,
        day,
        openDay,
        timeUntilNewDay,
        loreScene,
        loreTitle,
        loreBody,
        particles,
        showLoreModal,
        completeDay,
        completeMastery,
        minWidth: 700,
        isMastery,
        toggleMastery,
        swappingMastery,
        currentlyMastering,
        masteredDays,
        creditsOpen,
        credits,
        hasWon,
        display: jsx(() => (
            <>
                {player.devSpeed === 0 ? <div>Game Paused</div> : null}
                {player.devSpeed != null && player.devSpeed !== 0 && player.devSpeed !== 1 ? (
                    <div>Dev Speed: {format(player.devSpeed)}x</div>
                ) : null}
                {player.offlineTime != null && player.offlineTime !== 0 ? (
                    <div>Offline Time: {formatTime(player.offlineTime)}</div>
                ) : null}
                <Spacer />
                {isMastery.value ? (
                    <>
                        <div>Now decorating {currentlyMastering.value?.name}</div>
                        <Spacer />
                    </>
                ) : null}
                <div class={{ advent: true, decorating: isMastery.value }}>
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
                {hasWon.value ? (
                    <>
                        <Spacer />
                        <button
                            class="button"
                            style="font-size: xx-large"
                            onClick={() => (creditsOpen.value = true)}
                        >
                            Open Credits
                        </button>
                    </>
                ) : null}
                {render(particles)}
            </>
        ))
    };
});

watchEffect(() => {
    if (player.tabs.length === 1) {
        main.minimized.value = false;
    }
});

/**
 * Given a player save data object being loaded, return a list of layers that should currently be enabled.
 * If your project does not use dynamic layers, this should just return all layers.
 */
export const getInitialLayers = (
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    player: Partial<Player>
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
    management,
    letters,
    wrappingPaper,
    ribbon,
    toys,
    factory,
    reindeer,
    sleigh,
    routing,
    packing
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
    player: Partial<Player>
    // eslint-disable-next-line @typescript-eslint/no-empty-function
): void {
    if (oldVersion !== undefined && oldVersion < "0.6") {
        if ((player.layers?.main as typeof main)?.day !== undefined) {
            (player.layers?.main as typeof main).day.value = Math.min(
                (player.layers?.main as typeof main).day.value,
                23
            );
        }
    }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
