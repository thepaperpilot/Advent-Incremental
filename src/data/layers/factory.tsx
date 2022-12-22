import { Application } from "@pixi/app";
import { Assets } from "@pixi/assets";
import { Container } from "@pixi/display";
import { Graphics } from "@pixi/graphics";
import { Sprite } from "@pixi/sprite";
import HotkeyVue from "components/Hotkey.vue";
import Row from "components/layout/Row.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { createBuyable } from "features/buyable";
import { jsx } from "features/feature";
import { createHotkey, GenericHotkey } from "features/hotkey";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, Resource } from "features/resources/resource";
import { createTab } from "features/tabs/tab";
import { createTabFamily } from "features/tabs/tabFamily";
import Tooltip from "features/tooltips/Tooltip.vue";
import { globalBus } from "game/events";
import { createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createMultiplicativeModifier,
    createSequentialModifier
} from "game/modifiers";
import { noPersist, Persistent, persistent, State } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { ProcessedComputable } from "util/computed";
import { render, renderRow } from "util/vue";
import { computed, ComputedRef, reactive, ref, unref, watchEffect } from "vue";
import coal from "./coal";
import _block from "./factory-components/block.svg";
import _blockMaker from "./factory-components/blockmaker.svg";
import _clothes from "./factory-components/clothes.svg";
import _clothesMaker from "./factory-components/clothesmaker.svg";
import _conveyor from "./factory-components/conveyor.png";
import _cursor from "./factory-components/cursor.svg";
import _delete from "./factory-components/delete.svg";
import _wood from "./factory-components/log.svg";
import _plank from "./factory-components/plank.svg";
import _rotateLeft from "./factory-components/rotateLeft.svg";
import _rotateRight from "./factory-components/rotateRight.svg";
import _plankMaker from "./factory-components/sawmill.svg";
import _shed from "./factory-components/shed.svg";
import _metal from "../symbols/metal.png";
import _plastic from "../symbols/plastic.png";
import _cloth from "../symbols/cloth.png";
import _dye from "../symbols/dyes.png";
import _thread from "./factory-components/thread.svg";
import _threadMaker from "./factory-components/threadmaker.svg";
import _truck from "./factory-components/truck.svg";
import _truckMaker from "./factory-components/truckmaker.svg";
import _wheel from "./factory-components/wheel.svg";
import _wheelMaker from "./factory-components/wheelmaker.svg";
import Factory from "./Factory.vue";
import "./styles/factory.css";
import Toy from "./Toy.vue";
import toys from "./toys";

const id = "factory";

// what is the actual day?
const day = 18;

const toyGoal = 750;

// 20x20 block size
// TODO: unhardcode stuff

function roundDownTo(num: number, multiple: number) {
    return Math.floor((num + multiple / 2) / multiple) * multiple;
}
function getRelativeCoords(e: MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}
function rotateDir(dir: Direction, relative = Direction.Right) {
    const directions = [Direction.Up, Direction.Right, Direction.Down, Direction.Left];
    let index = directions.indexOf(dir);
    index += directions.indexOf(relative);
    index = index % directions.length;
    return directions[index];
}
function directionToNum(dir: Direction) {
    switch (dir) {
        case Direction.Left:
        case Direction.Up:
            return -1;
        case Direction.Right:
        case Direction.Down:
            return 1;
    }
}
function getDirection(dir: Direction) {
    switch (dir) {
        case Direction.Left:
        case Direction.Right:
            return "h";
        case Direction.Up:
        case Direction.Down:
            return "v";
    }
}
const blockSize = 50;

const factory = createLayer(id, () => {
    // layer display
    const name = "The Factory";
    const color = "grey";

    const energy = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.add(1, coal.coal.value).log10(),
            description: "Coal Energy Production"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 1.4,
            description: "2000 toys",
            enabled: toys.milestones.milestone6.earned
        }))
    ]);
    const computedEnergy = computed(() => energy.apply(0));
    const energyConsumption = computed(() =>
        Object.values(components.value)
            .map(c => FACTORY_COMPONENTS[c.type]?.energyCost ?? 0)
            .reduce((a, b) => a + b, 0)
    );
    const energyEfficiency = computed(() =>
        Decimal.div(energyConsumption.value, computedEnergy.value).recip().pow(2).min(1)
    );
    const tickRate = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: elvesEffect,
            description: "Trained Elves"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: energyEfficiency,
            description: "Energy Consumption",
            enabled: () => Decimal.gt(energyConsumption.value, computedEnergy.value)
        }))
    ]);
    const computedTickRate = computed(() => tickRate.apply(1));
    const factorySize = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: expandFactory.amount,
            description: "Expand Factory",
            enabled: () => Decimal.gt(expandFactory.amount.value, 0)
        }))
    ]);
    const computedFactorySize = computed(() => new Decimal(factorySize.apply(7)).toNumber());

    const energyBar = createBar(() => ({
        width: 680,
        height: 50,
        direction: Direction.Right,
        classes: { "energy-bar": true },
        style: { borderRadius: "var(--border-radius) var(--border-radius) 0 0" },
        borderStyle: { borderRadius: "var(--border-radius) var(--border-radius) 0 0" },
        fillStyle: () => ({
            backgroundColor: Decimal.gt(energyConsumption.value, computedEnergy.value)
                ? "red"
                : "yellow"
        }),
        progress: () =>
            Decimal.gt(energyConsumption.value, computedEnergy.value)
                ? Decimal.sub(1, Decimal.div(computedEnergy.value, energyConsumption.value))
                : Decimal.sub(1, Decimal.div(energyConsumption.value, computedEnergy.value)),
        display: jsx(() => (
            <>
                <div>
                    {formatWhole(energyConsumption.value)} / {formatWhole(computedEnergy.value)}{" "}
                    energy used
                    {Decimal.gt(energyConsumption.value, computedEnergy.value) ? (
                        <>{" (" + format(Decimal.mul(energyEfficiency.value, 100))}% efficiency)</>
                    ) : (
                        ""
                    )}
                </div>
                <div>
                    <Tooltip display="Clear Tracks" direction={Direction.Down}>
                        <button class="control-btn material-icons" onClick={setTracks}>
                            clear
                        </button>
                    </Tooltip>
                    <Tooltip display="Clear Factory" direction={Direction.Down}>
                        <button class="control-btn material-icons" onClick={clearFactory}>
                            delete
                        </button>
                    </Tooltip>
                    <Tooltip display="Go to Center" direction={Direction.Down} xoffset="-26px">
                        <button class="control-btn material-icons" onClick={moveToCenter}>
                            center_focus_weak
                        </button>
                    </Tooltip>
                    <Tooltip
                        display={(paused.value ? "Unpause" : "Pause") + " the Factory"}
                        direction={Direction.Down}
                        xoffset="-63px"
                    >
                        <button class="control-btn material-icons" onClick={togglePaused}>
                            {paused.value ? "play_arrow" : "pause"}
                        </button>
                    </Tooltip>
                </div>
            </>
        ))
    }));

    // ---------------------------------------------- Components

    const FACTORY_COMPONENTS = {
        cursor: {
            imageSrc: _cursor,
            key: "Escape",
            name: "Cursor",
            type: "command",
            description: "Drag while equipping this to move around.",
            tick: 0
        } as FactoryComponentDeclaration,
        delete: {
            imageSrc: _delete,
            key: "Backspace",
            name: "Delete",
            type: "command",
            description: "Remove components from the board.",
            tick: 0
        } as FactoryComponentDeclaration,
        rotateLeft: {
            imageSrc: _rotateLeft,
            key: "t",
            name: "Rotate Left",
            type: "command",
            description: "Use this to rotate components counter-clockwise.",
            tick: 0
        } as FactoryComponentDeclaration,
        rotateRight: {
            imageSrc: _rotateRight,
            key: "shift+T",
            name: "Rotate Right",
            type: "command",
            description: "Use this to rotate components clockwise.",
            tick: 0
        } as FactoryComponentDeclaration,
        conveyor: {
            imageSrc: _conveyor,
            key: "0",
            name: "Conveyor",
            type: "conveyor",
            description: "Moves items at 1 block per second.",
            energyCost: 1,
            tick: 1,
            ports: {
                [Direction.Left]: {
                    type: "input"
                },
                [Direction.Right]: {
                    type: "output"
                }
            }
        } as FactoryComponentDeclaration,
        wood: {
            imageSrc: _shed,
            extraImage: _wood,
            key: "1",
            name: "Wood Machine",
            type: "processor",
            description: "Produces 1 wood per tick.",
            energyCost: 10,
            tick: 1,
            outputs: {
                wood: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        cloth: {
            imageSrc: _shed,
            extraImage: _cloth,
            key: "2",
            name: "Cloth Machine",
            type: "processor",
            description: "Produces 1 cloth per tick.",
            energyCost: 10,
            tick: 1,
            outputs: {
                cloth: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        dye: {
            imageSrc: _shed,
            extraImage: _dye,
            key: "3",
            name: "Dye Machine",
            type: "processor",
            description: "Produces 1 dye per tick.",
            energyCost: 10,
            tick: 1,
            outputs: {
                dye: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        metal: {
            imageSrc: _shed,
            extraImage: _metal,
            key: "4",
            name: "Metal Machine",
            type: "processor",
            description: "Produces 1 metal per tick.",
            energyCost: 10,
            tick: 1,
            outputs: {
                metal: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        plastic: {
            imageSrc: _shed,
            extraImage: _plastic,
            key: "5",
            name: "Plastic Machine",
            type: "processor",
            description: "Produces 1 plastic per tick.",
            energyCost: 10,
            tick: 1,
            outputs: {
                plastic: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        plank: {
            imageSrc: _plankMaker,
            key: "shift+1",
            name: "Sawmill",
            type: "processor",
            description: "Turns 1 wood into 1 plank per tick.",
            energyCost: 2,
            tick: 1,
            inputs: {
                wood: {
                    amount: 1
                }
            },
            outputs: {
                plank: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        thread: {
            imageSrc: _threadMaker,
            key: "shift+2",
            name: "Thread Spinner",
            type: "processor",
            description: "Turns 1 cloth into 1 thread per tick.",
            energyCost: 2,
            tick: 1,
            inputs: {
                cloth: {
                    amount: 1
                }
            },
            outputs: {
                thread: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        wheel: {
            imageSrc: _wheelMaker,
            key: "shift+3",
            name: "Wheel Crafter",
            type: "processor",
            // TODO construct descriptions dynamically better
            description: computed(
                () =>
                    `Turns 1 plastic into ${
                        toys.milestones.milestone5.earned.value ? "2 wheels" : "1 wheel"
                    } per tick.`
            ),
            energyCost: 2,
            tick: 1,
            inputs: {
                plastic: {
                    amount: 1
                }
            },
            outputs: {
                wheel: {
                    amount: computed(() => (toys.milestones.milestone5.earned.value ? 2 : 1))
                }
            }
        } as FactoryComponentDeclaration,
        blocks: {
            imageSrc: _blockMaker,
            key: "ctrl+shift+1",
            name: "Wooden Block Maker",
            type: "processor",
            description: "Turns 1 plank into 1 wooden block per tick.",
            energyCost: 20,
            tick: 1,
            inputs: {
                plank: {
                    amount: 1
                }
            },
            outputs: {
                block: {
                    amount: 1,
                    resource: toys.woodenBlocks
                }
            }
        } as FactoryComponentDeclaration,
        clothes: {
            imageSrc: _clothesMaker,
            key: "ctrl+shift+2",
            name: "Clothes Maker",
            type: "processor",
            description: "Turns 2 threads, 3 cloth, and 1 dye into 1 clothes per tick.",
            energyCost: 20,
            tick: 1,
            inputs: {
                thread: {
                    amount: 2
                },
                cloth: {
                    amount: 3
                },
                dye: {
                    amount: 1
                }
            },
            outputs: {
                clothes: {
                    amount: 1,
                    resource: toys.clothes
                }
            }
        } as FactoryComponentDeclaration,
        trucks: {
            imageSrc: _truckMaker,
            key: "ctrl+shift+3",
            name: "Trucks Maker",
            type: "processor",
            description: "Turns 2 metal and 4 wheels into 1 truck per tick.",
            energyCost: 20,
            tick: 1,
            inputs: {
                metal: {
                    amount: 2
                },
                wheel: {
                    amount: 4
                }
            },
            outputs: {
                trucks: {
                    amount: 1,
                    resource: toys.trucks
                }
            }
        } as FactoryComponentDeclaration
    } as const;
    const RESOURCES = {
        // Raw resources
        wood: {
            name: "Wood",
            imageSrc: _wood
        },
        cloth: {
            name: "Cloth",
            imageSrc: _cloth
        },
        dye: {
            name: "Dye",
            imageSrc: _dye
        },
        plastic: {
            name: "Plastic",
            imageSrc: _plastic
        },
        metal: {
            name: "Metal",
            imageSrc: _metal
        },
        // Processed resources
        plank: {
            name: "Planks",
            imageSrc: _plank
        },
        thread: {
            name: "Thread",
            imageSrc: _thread
        },
        wheel: {
            name: "Wheels",
            imageSrc: _wheel
        },
        // Toys
        block: {
            name: "Wooden Blocks",
            imageSrc: _block
        },
        clothes: {
            name: "Clothes",
            imageSrc: _clothes
        },
        trucks: {
            name: "Trucks",
            imageSrc: _truck
        }
    } as const;

    const hotkeys = (Object.keys(FACTORY_COMPONENTS) as FactoryCompNames[]).reduce((acc, comp) => {
        acc[comp] = createHotkey(() => ({
            key: FACTORY_COMPONENTS[comp].key,
            description: "Select " + FACTORY_COMPONENTS[comp].name,
            onPress() {
                compSelected.value = comp;
            },
            enabled: noPersist(main.days[day - 1].opened)
        }));
        return acc;
    }, {} as Record<FactoryCompNames, GenericHotkey>);

    type FactoryCompNames = keyof typeof FACTORY_COMPONENTS;
    type BuildableCompName = Exclude<FactoryCompNames, "cursor">;
    type ResourceNames = keyof typeof RESOURCES;

    interface FactoryComponentBase extends Record<string, State> {
        direction: Direction;
    }

    interface FactoryComponentProcessor extends FactoryComponentBase {
        type: Exclude<BuildableCompName, "conveyor">;
        inputStock?: Partial<Record<ResourceNames, number>>;

        // current production stock
        outputStock?: Partial<Record<ResourceNames, number>>;
        ticksDone: number;
    }

    interface FactoryComponentConveyor extends FactoryComponentBase {
        type: "conveyor";
    }

    type FactoryComponent = FactoryComponentBase &
        (FactoryComponentConveyor | FactoryComponentProcessor);

    type Stock = Partial<
        Record<
            ResourceNames,
            {
                amount: ProcessedComputable<number>;
                capacity?: number;
                resource?: Resource;
            }
        >
    >;

    interface FactoryComponentDeclaration {
        tick: number;
        key: string;
        imageSrc: string;
        extraImage?: string;
        name: string;
        type: "command" | "conveyor" | "processor";
        description: ProcessedComputable<string>;
        energyCost?: number;

        /** amount it consumes */
        inputs?: Stock;
        /** amount it produces */
        outputs?: Stock;

        /** on produce, do something */
        onProduce?: (times: number) => void;
        /** can it produce? (in addtion to the stock check) */
        canProduce?: ComputedRef<boolean>;
    }

    interface FactoryInternalBase {
        sprite: Sprite;
        canProduce: ComputedRef<boolean>;
    }
    interface FactoryInternalConveyor extends FactoryInternalBase {
        type: "conveyor";

        // packages are sorted by last first, first last
        // [componentMade5SecondsAgo, componentMade4SecondsAgo...]
        packages: Block[];
        nextPackages: Block[];
    }
    interface FactoryInternalProcessor extends FactoryInternalBase {
        type: Exclude<BuildableCompName, "conveyor">;
    }
    type FactoryInternal = FactoryInternalConveyor | FactoryInternalProcessor;

    interface Block {
        sprite: Sprite;
        type: ResourceNames;
        // in block amts, not screen
        x: number;
        y: number;
        // make blocks turn in random amounts;
        turbulance: number;
    }

    // mouse positions
    const mouseCoords = reactive({
        x: 0,
        y: 0
    });
    const mapOffset = reactive({
        x: 0,
        y: 0
    });
    const isMouseHoverShown = ref(false);

    const compSelected = ref<FactoryCompNames>("cursor");
    const components: Persistent<{ [key: string]: FactoryComponent }> = persistent({});
    const compInternalData: Record<string, FactoryInternal> = {};

    // trained elves

    const clothesBuyable = createBuyable(() => ({
        resource: toys.clothes,
        cost() {
            return Decimal.pow(2, Decimal.add(this.amount.value, 5));
        },
        display: {
            title: "Train elves to make clothes",
            description: "Use your finished toys to train an elf on factory work"
        }
    }));
    const blocksBuyable = createBuyable(() => ({
        resource: toys.woodenBlocks,
        cost() {
            return Decimal.pow(2, Decimal.add(this.amount.value, 5));
        },
        display: {
            title: "Train elves to make wooden blocks",
            description: "Use your finished toys to train an elf on factory work"
        }
    }));
    const trucksBuyable = createBuyable(() => ({
        resource: toys.trucks,
        cost() {
            return Decimal.pow(2, Decimal.add(this.amount.value, 5));
        },
        display: {
            title: "Train elves to make toy trucks",
            description: "Use your finished toys to train an elf on factory work"
        }
    }));
    const elfBuyables = { clothesBuyable, blocksBuyable, trucksBuyable };

    const sumElves = computed(() =>
        Object.values(elfBuyables)
            .map(b => b.amount.value)
            .reduce(Decimal.add, 0)
    );
    const trainedElves = createResource<DecimalSource>(sumElves, "trained elves");
    const elvesEffect = computed(() => Decimal.add(trainedElves.value, 1).log10().add(1));

    const expandFactory = createBuyable(() => ({
        canPurchase: true
    }));
    const factoryBuyables = { expandFactory };

    // pixi

    // load every sprite here so pixi doesn't complain about loading multiple times
    const assetsLoading = Promise.all([
        Assets.load(Object.values(FACTORY_COMPONENTS).map(x => x.imageSrc)),
        Assets.load(
            Object.values(FACTORY_COMPONENTS)
                .map(x => x.extraImage)
                .filter(x => x != null) as string[]
        ),
        Assets.load(Object.values(RESOURCES).map(x => x.imageSrc))
    ]);

    const app = new Application({
        backgroundAlpha: 0
    });
    const graphicContainer = new Graphics();
    let spriteContainer = new Container();
    const movingBlocks = new Container();
    let hoverSprite = new Sprite();

    spriteContainer.zIndex = 0;
    movingBlocks.zIndex = 1;
    graphicContainer.zIndex = 2;
    app.stage.addChild(graphicContainer, spriteContainer, movingBlocks);
    app.stage.sortableChildren = true;
    let loaded = false;

    globalBus.on("onLoad", async () => {
        loaded = false;

        spriteContainer.destroy({
            children: true
        });
        spriteContainer = new Container();
        app.stage.addChild(spriteContainer);

        const floorGraphics = new Graphics();
        spriteContainer.addChild(floorGraphics);

        watchEffect(() => {
            floorGraphics.clear();
            floorGraphics.beginFill(0x70645d);
            floorGraphics.drawRect(
                (-computedFactorySize.value * blockSize) / 2,
                (-computedFactorySize.value * blockSize) / 2,
                computedFactorySize.value * blockSize,
                computedFactorySize.value * blockSize
            );
            floorGraphics.endFill();
        });

        await assetsLoading;

        if (Array.isArray(components.value)) {
            components.value = {};
        } else {
            for (const id in components.value) {
                const data = components.value[id];
                if (data?.type === undefined) {
                    delete components.value[id];
                    continue;
                }
                const [x, y] = id.split("x").map(p => +p);
                addFactoryComp(x, y, data);
            }
        }

        updateGraphics();

        loaded = true;
        watchEffect(updateGraphics);
    });
    (window as any).internal = compInternalData;
    (window as any).comp = components;
    (window as any).blocks = movingBlocks;

    function moveBlock(block: Block, newBlock: FactoryInternal, blockData: FactoryComponent) {
        // empty spot
        if (newBlock === undefined) {
            // just delete it
            movingBlocks.removeChild(block.sprite);
        } else if (newBlock.type === "conveyor") {
            // push it to the next conveyor, kill it from the
            // curent conveyor
            block.turbulance = Math.random() * 0.4 - 0.2;
            (newBlock as FactoryInternalConveyor).nextPackages.push(block);
        } else {
            // send it to the factory
            // destroy its sprite and data
            const factoryData = blockData as FactoryComponentProcessor;
            if (factoryData.inputStock !== undefined) {
                factoryData.inputStock[block.type] = Math.min(
                    (factoryData.inputStock[block.type] ?? 0) + 1,
                    FACTORY_COMPONENTS[newBlock.type].inputs?.[block.type]?.capacity ?? Infinity
                );
            }
            movingBlocks.removeChild(block.sprite);
        }
    }

    globalBus.on("update", diff => {
        if (!loaded || paused.value) return;

        const factoryTicks = Decimal.times(computedTickRate.value, diff).toNumber();

        //debugger
        // make them produce
        for (const id in components.value) {
            const [x, y] = id.split("x").map(p => +p);
            const _data = components.value[id];
            const _compData = compInternalData[id];
            if (_data === undefined || _compData === undefined) continue;
            const factoryData = FACTORY_COMPONENTS[_data.type];
            // debugger;
            if (_data.type === "conveyor") {
                const data = _data as FactoryComponentConveyor;
                const compData = _compData as FactoryInternalConveyor;
                if (compData.type !== "conveyor") throw new TypeError("this should not happen");
                // conveyor part
                // use a copy
                compData.packages = compData.packages.concat(compData.nextPackages);
                compData.nextPackages = [];
                for (let key = 0; key < compData.packages.length; key++) {
                    const block = compData.packages[key];
                    const inputDirection = data.direction;
                    const dirType = getDirection(inputDirection);
                    const dirAmt = directionToNum(inputDirection);
                    if (dirType === "h") {
                        if ((block.x - x) * dirAmt >= 1 + block.turbulance) {
                            const compBehind = compInternalData[x + dirAmt + "x" + y];
                            const storedComp = components.value[x + dirAmt + "x" + y];

                            moveBlock(block, compBehind, storedComp);

                            compData.packages.splice(key, 1);
                            key--;
                        } else {
                            const change =
                                dirAmt *
                                Math.min(Math.abs(x + 1.3 * dirAmt - block.x), factoryTicks);
                            block.x += change;
                            block.sprite.x += change * blockSize;
                        }
                    } else {
                        if ((block.y - y) * dirAmt >= 1 + block.turbulance) {
                            const compBehind = compInternalData[x + "x" + (y + dirAmt)];
                            const storedComp = components.value[x + "x" + (y + dirAmt)];

                            moveBlock(block, compBehind, storedComp);

                            compData.packages.splice(key, 1);
                            key--;
                        } else {
                            const change =
                                dirAmt *
                                Math.min(Math.abs(y + 1.3 * dirAmt - block.y), factoryTicks);
                            block.y += change;
                            block.sprite.y += change * blockSize;
                        }
                    }
                }
            } else {
                const data = _data as FactoryComponentProcessor;
                const compData = _compData as FactoryInternalProcessor;
                // factory part
                // PRODUCTION
                if (data.ticksDone >= factoryData.tick) {
                    if (compData.canProduce.value) {
                        const cyclesDone = Math.floor(data.ticksDone / factoryData.tick);
                        factoryData.onProduce?.(cyclesDone);
                        if (factoryData.inputs !== undefined) {
                            if (data.inputStock === undefined) data.inputStock = {};
                            for (const [key, val] of Object.entries(factoryData.inputs)) {
                                data.inputStock[key as ResourceNames] =
                                    (data.inputStock[key as ResourceNames] ?? 0) -
                                    unref(val.amount);
                            }
                        }
                        if (factoryData.outputs !== undefined) {
                            if (data.outputStock === undefined) data.outputStock = {};
                            for (const [key, val] of Object.entries(factoryData.outputs)) {
                                if (val.resource != null) {
                                    val.resource.value = Decimal.add(
                                        val.resource.value,
                                        unref(val.amount)
                                    );
                                } else {
                                    data.outputStock[key as ResourceNames] =
                                        (data.outputStock[key as ResourceNames] ?? 0) +
                                        unref(val.amount);
                                }
                            }
                        }
                        data.ticksDone -= cyclesDone * factoryData.tick;
                    }
                } else {
                    data.ticksDone += factoryTicks;
                }
                // now look at each component direction and see if it accepts items coming in
                // components are 1x1 so simple math for now

                const incs: [number, number][] = [];
                if (
                    components.value[x + "x" + (y + 1)]?.type === "conveyor" &&
                    components.value[x + "x" + (y + 1)].direction === Direction.Down
                ) {
                    incs.push([0, 1]);
                }
                if (
                    components.value[x + "x" + (y - 1)]?.type === "conveyor" &&
                    components.value[x + "x" + (y - 1)].direction === Direction.Up
                ) {
                    incs.push([0, -1]);
                }
                if (
                    components.value[x + 1 + "x" + y]?.type === "conveyor" &&
                    components.value[x + 1 + "x" + y].direction === Direction.Right
                ) {
                    incs.push([1, 0]);
                }
                if (
                    components.value[x - 1 + "x" + y]?.type === "conveyor" &&
                    components.value[x - 1 + "x" + y].direction === Direction.Left
                ) {
                    incs.push([-1, 0]);
                }
                // no suitable location to dump stuff in
                // console.log(x, y);
                // debugger;
                if (incs.length <= 0) continue;
                const [xInc, yInc] = incs[Math.floor(Math.random() * incs.length)];
                let itemToMove: [ResourceNames, number] | undefined = undefined;
                if (data.outputStock !== undefined) {
                    for (const [name, amt] of Object.entries(data.outputStock)) {
                        if (amt >= 1) {
                            itemToMove = [name as ResourceNames, amt];
                            data.outputStock[name as ResourceNames]!--;
                            break;
                        }
                    }
                }
                // there is nothing to move
                if (itemToMove === undefined) continue;
                const texture = Assets.get(RESOURCES[itemToMove[0]].imageSrc);
                const sprite = new Sprite(texture);

                /*
                    go left     go right
                              go top
                                x
                    default -> CCC
                             x CCC x
                               CCC
                                x
                              go bottom
                    */
                // if X is being moved, then we don't need to adjust x
                // however it needs to be aligned if Y is being moved
                // vice-versa
                sprite.x =
                    (x + xInc * 0.3 + (xInc == 0 ? Math.random() * 0.4 - 0.2 : 0)) * blockSize;
                sprite.y =
                    (y + yInc * 0.3 + (yInc == 0 ? Math.random() * 0.4 - 0.2 : 0)) * blockSize;
                sprite.anchor.set(0.5);
                sprite.width = blockSize / 2.5;
                sprite.height = blockSize / 2.5;
                //console.log(sprite);
                const block: Block = {
                    sprite,
                    x: sprite.x / blockSize,
                    y: sprite.y / blockSize,
                    turbulance: Math.random() * 0.4 - 0.2,
                    type: itemToMove[0]
                };

                (
                    compInternalData[x + xInc + "x" + (y + yInc)] as FactoryInternalConveyor
                ).nextPackages.push(block);
                movingBlocks.addChild(sprite);
            }
        }
    });

    function addFactoryComp(
        x: number,
        y: number,
        data: Partial<FactoryComponent> & { type: BuildableCompName }
    ) {
        if (x < -computedFactorySize.value / 2 || x >= computedFactorySize.value / 2) return;
        if (y < -computedFactorySize.value / 2 || y >= computedFactorySize.value / 2) return;

        const factoryBaseData = FACTORY_COMPONENTS[data.type];
        if (factoryBaseData == undefined) return;
        const sheet = Assets.get(factoryBaseData.imageSrc);
        const sprite = new Sprite(sheet);

        watchEffect(() => {
            if (computedFactorySize.value % 2 === 0) {
                sprite.x = (x + 0.5) * blockSize;
                sprite.y = (y + 0.5) * blockSize;
            } else {
                sprite.x = x * blockSize;
                sprite.y = y * blockSize;
            }
        });
        sprite.width = blockSize;
        sprite.height = blockSize;
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 0.5;
        sprite.rotation =
            ([Direction.Right, Direction.Down, Direction.Left, Direction.Up].indexOf(
                data.direction ?? Direction.Right
            ) *
                Math.PI) /
            2;
        if (factoryBaseData.extraImage != null) {
            const sheet = Assets.get(factoryBaseData.extraImage);
            const extraSprite = new Sprite(sheet);
            extraSprite.width = blockSize / 3;
            extraSprite.height = blockSize / 3;
            extraSprite.position.set(-blockSize / 3, 0);
            sprite.addChild(extraSprite);
        }
        components.value[x + "x" + y] = {
            ticksDone: 0,
            direction: Direction.Right,
            inputStock:
                factoryBaseData.inputs === undefined
                    ? undefined
                    : Object.fromEntries(
                          Object.entries(factoryBaseData.inputs).map(x => [x[0], 0])
                      ),
            outputStock:
                factoryBaseData.outputs === undefined
                    ? undefined
                    : Object.fromEntries(
                          Object.entries(factoryBaseData.outputs).map(x => [x[0], 0])
                      ),
            ...data
        } as FactoryComponent;
        const isConveyor = data.type === "conveyor";
        compInternalData[x + "x" + y] = {
            type: data.type,
            packages: isConveyor ? [] : undefined,
            nextPackages: isConveyor ? [] : undefined,
            canProduce: computed(() => {
                if (data.type === "conveyor") return true;
                if (!(factoryBaseData.canProduce?.value ?? true)) return false;
                // this should NEVER be null
                const compData = components.value[x + "x" + y] as FactoryComponentProcessor;
                if (factoryBaseData.inputs !== undefined) {
                    for (const [res, val] of Object.entries(factoryBaseData.inputs))
                        if ((compData.inputStock?.[res as ResourceNames] ?? 0) < val.amount)
                            return false;
                }
                if (factoryBaseData.outputs !== undefined) {
                    for (const [res, val] of Object.entries(factoryBaseData.outputs))
                        if (
                            (compData.outputStock?.[res as ResourceNames] ?? 0) +
                                unref(val.amount) >
                            (val.capacity ?? Infinity)
                        )
                            return false;
                }
                return true;
            }),
            sprite
        } as FactoryInternalProcessor;
        spriteContainer.addChild(sprite);
    }

    function removeFactoryComp(x: number, y: number) {
        const data = compInternalData[x + "x" + y];
        if (data === undefined) return;

        if (data.type === "conveyor") {
            const cData = data as FactoryInternalConveyor;
            for (const p of cData.packages) {
                p.sprite.destroy();
            }
        }

        delete components.value[x + "x" + y];
        delete compInternalData[x + "x" + y];
        spriteContainer.removeChild(data.sprite);
    }

    // draw graphics
    function updateGraphics() {
        app.resize();
        graphicContainer.clear();
        // make (0, 0) the center of the screen
        const calculatedX = mapOffset.x * blockSize + app.view.width / 2;
        const calculatedY = mapOffset.y * blockSize + app.view.height / 2;

        spriteContainer.x = movingBlocks.x = calculatedX;
        spriteContainer.y = movingBlocks.y = calculatedY;

        graphicContainer.removeChild(hoverSprite);
        if (isMouseHoverShown.value && compSelected.value !== "cursor") {
            const { tx, ty } = spriteContainer.localTransform;
            graphicContainer.lineStyle(4, 0x808080, 1);
            graphicContainer.drawRect(
                roundDownTo(mouseCoords.x - tx, blockSize) + tx - blockSize / 2,
                roundDownTo(mouseCoords.y - ty, blockSize) + ty - blockSize / 2,
                blockSize,
                blockSize
            );
            const factoryBaseData = FACTORY_COMPONENTS[compSelected.value];
            const sheet = Assets.get(factoryBaseData.imageSrc);
            hoverSprite = new Sprite(sheet);
            hoverSprite.x = roundDownTo(mouseCoords.x - tx, blockSize) + tx - blockSize / 2;
            hoverSprite.y = roundDownTo(mouseCoords.y - ty, blockSize) + ty - blockSize / 2;
            hoverSprite.width = blockSize;
            hoverSprite.height = blockSize;
            hoverSprite.alpha = 0.5;
            hoverSprite.alpha = 0.5;
            graphicContainer.addChild(hoverSprite);
        }
    }

    const pointerDown = ref(false),
        pointerDrag = ref(false),
        compHovered = ref<FactoryComponent | undefined>(undefined),
        paused = ref(false);

    function onFactoryPointerMove(e: PointerEvent) {
        const { x, y } = getRelativeCoords(e);
        mouseCoords.x = x;
        mouseCoords.y = y;

        if (
            pointerDown.value &&
            (pointerDrag.value ||
                (compSelected.value === "cursor" &&
                    (Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2)))
        ) {
            pointerDrag.value = true;
            mapOffset.x += e.movementX / blockSize;
            mapOffset.y += e.movementY / blockSize;
            // the maximum you can see currently
            // total size of blocks - current size = amount you should move
            mapOffset.x = Math.min(
                Math.max(mapOffset.x, (-computedFactorySize.value + 1) / 2),
                (computedFactorySize.value + 1) / 2
            );
            mapOffset.y = Math.min(
                Math.max(mapOffset.y, (-computedFactorySize.value + 1) / 2),
                (computedFactorySize.value + 1) / 2
            );
        }
        if (!pointerDown.value && !pointerDrag.value) {
            const { tx, ty } = spriteContainer.localTransform;
            compHovered.value =
                components.value[
                    Math.round(roundDownTo(x - tx, blockSize) / blockSize) +
                        "x" +
                        Math.round(roundDownTo(y - ty, blockSize) / blockSize)
                ];
        }
    }
    function onFactoryPointerDown(e: PointerEvent) {
        window.addEventListener("pointerup", onFactoryPointerUp);
        pointerDown.value = true;
        if (e.button === 1) {
            pointerDrag.value = true;
        }
    }
    function onFactoryPointerUp(e: PointerEvent) {
        // make sure they're not dragging and that
        // they aren't trying to put down a cursor
        if (!pointerDrag.value) {
            const { tx, ty } = spriteContainer.localTransform;
            let { x, y } = getRelativeCoords(e);
            x = roundDownTo(x - tx, blockSize) / blockSize;
            y = roundDownTo(y - ty, blockSize) / blockSize;
            if (e.button === 0) {
                if (compSelected.value === "rotateLeft") {
                    if (
                        components.value[x + "x" + y] != null &&
                        components.value[x + "x" + y].direction != null
                    ) {
                        components.value[x + "x" + y] = {
                            ...components.value[x + "x" + y],
                            direction: rotateDir(
                                (components.value[x + "x" + y] as FactoryComponentConveyor)
                                    .direction,
                                Direction.Left
                            )
                        };
                        compInternalData[x + "x" + y].sprite.rotation -= Math.PI / 2;
                    }
                } else if (compSelected.value === "rotateRight") {
                    if (
                        components.value[x + "x" + y] != null &&
                        components.value[x + "x" + y].direction != null
                    ) {
                        components.value[x + "x" + y] = {
                            ...components.value[x + "x" + y],
                            direction: rotateDir(
                                (components.value[x + "x" + y] as FactoryComponentConveyor)
                                    .direction,
                                Direction.Right
                            )
                        };
                        compInternalData[x + "x" + y].sprite.rotation += Math.PI / 2;
                    }
                } else if (compSelected.value === "delete") {
                    removeFactoryComp(x, y);
                } else if (compSelected.value !== "cursor") {
                    if (components.value[x + "x" + y] == null) {
                        addFactoryComp(x, y, { type: compSelected.value });
                    }
                }
            }
        }

        window.removeEventListener("pointerup", onFactoryPointerUp);
        pointerDown.value = pointerDrag.value = false;
        onFactoryPointerMove(e);
    }
    function onFactoryMouseEnter() {
        isMouseHoverShown.value = true;
    }
    function onFactoryMouseLeave() {
        isMouseHoverShown.value = false;
        compHovered.value = undefined;
    }

    function onCompClick(name: FactoryCompNames) {
        compSelected.value = name;
    }

    function setTracks() {
        for (const [key, comp] of Object.entries(compInternalData)) {
            if (comp == null) continue;
            if (comp.type === "conveyor") {
                const cComp = comp as FactoryInternalConveyor;
                for (const pkg of [...cComp.nextPackages, ...cComp.packages]) {
                    pkg.sprite.destroy();
                    movingBlocks.removeChild(pkg.sprite);
                }
                cComp.nextPackages = [];
                cComp.packages = [];
            } else {
                const producerComp = components.value[key] as FactoryComponentProcessor;
                if (producerComp.outputStock !== undefined) {
                    for (const key in producerComp.outputStock) {
                        delete producerComp.outputStock[key as ResourceNames];
                    }
                }
                if (producerComp.inputStock !== undefined) {
                    for (const key in producerComp.inputStock) {
                        delete producerComp.inputStock[key as ResourceNames];
                    }
                }
                producerComp.ticksDone = 0;
            }
        }
    }

    function clearFactory() {
        for (const key of Object.keys(compInternalData)) {
            const [x, y] = key.split("x").map(i => +i);
            removeFactoryComp(x, y);
        }
    }
    function moveToCenter() {
        mapOffset.x = 0;
        mapOffset.y = 0;
    }
    function togglePaused() {
        paused.value = !paused.value;
    }

    // ------------------------------------------------------------------------------- Tabs

    const componentsList = jsx(() => {
        return (
            <div class="comp-container">
                <div class="comp-list">
                    {Object.entries(FACTORY_COMPONENTS).map(value => {
                        const key = value[0] as FactoryCompNames;
                        const item = value[1];
                        return (
                            <div class="comp">
                                <img
                                    src={item.imageSrc}
                                    class={{ selected: compSelected.value === key }}
                                    onClick={() => onCompClick(key)}
                                />
                                {item.extraImage == null ? null : (
                                    <img src={item.extraImage} class="producedItem" />
                                )}
                                <div
                                    class={{
                                        "comp-info": true
                                    }}
                                >
                                    <h3>
                                        {FACTORY_COMPONENTS[key].name + " "}
                                        <HotkeyVue hotkey={hotkeys[key]} />
                                    </h3>
                                    <br />
                                    {unref(FACTORY_COMPONENTS[key].description)}
                                    {FACTORY_COMPONENTS[key].energyCost ?? 0 ? (
                                        <>
                                            <br />
                                            Energy Consumption:{" "}
                                            {formatWhole(FACTORY_COMPONENTS[key].energyCost ?? 0)}
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    });

    function showStockAmount(
        stocks: Partial<Record<ResourceNames, number>> | undefined,
        stockData: Stock | undefined,
        title: string,
        showAmount = true
    ) {
        if (stocks == null || stockData == null) {
            return undefined;
        }
        return (
            <>
                <br />
                <h5>{title}</h5>
                {(Object.keys(stockData) as ResourceNames[]).map(res => (
                    <div>
                        {RESOURCES[res]?.name}:{" "}
                        {stockData[res]?.resource != null
                            ? formatWhole(stockData[res]!.resource!.value)
                            : formatWhole(stocks[res] ?? 0)}
                        {showAmount && stockData[res]?.amount != undefined
                            ? " / " + formatWhole(unref(stockData[res]!.amount))
                            : ""}
                        {stockData[res]?.capacity != undefined
                            ? " / " + formatWhole(stockData[res]!.capacity!)
                            : ""}
                    </div>
                ))}
            </>
        );
    }

    const hoveredComponent = jsx(() =>
        compHovered.value !== undefined ? (
            <div
                class="info-container"
                id="factory-info"
                style={{
                    ...(mouseCoords.x +
                        (document.getElementById("factory-info")?.clientWidth ?? 0) >
                    app.view.width - 30
                        ? { right: app.view.width - mouseCoords.x + "px" }
                        : { left: mouseCoords.x + 148 + "px" }),
                    ...(mouseCoords.y +
                        (document.getElementById("factory-info")?.clientHeight ?? 0) >
                    app.view.height - 30
                        ? { bottom: app.view.height - mouseCoords.y + "px" }
                        : { top: mouseCoords.y + "px" })
                }}
            >
                <h3>{FACTORY_COMPONENTS[compHovered.value.type].name}</h3>
                <br />
                {unref(FACTORY_COMPONENTS[compHovered.value.type].description)}
                <br />
                {compHovered.value.type !== "conveyor" ? (
                    <>
                        {showStockAmount(
                            compHovered.value.inputStock,
                            FACTORY_COMPONENTS[compHovered.value.type].inputs,
                            "Inputs:"
                        )}
                        {showStockAmount(
                            compHovered.value.outputStock,
                            FACTORY_COMPONENTS[compHovered.value.type].outputs,
                            "Outputs:",
                            false
                        )}
                    </>
                ) : undefined}
            </div>
        ) : (
            ""
        )
    );

    const tabs = createTabFamily(
        {
            dashboard: () => ({
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            <div>
                                {main.day.value === day
                                    ? `Reach ${format(toyGoal)} for each toy to complete the day`
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
                            <Spacer />
                            <Row>
                                <Toy resource={toys.clothes} image={_clothes} color="lightblue" />
                                <Toy
                                    resource={toys.woodenBlocks}
                                    image={_block}
                                    color="cornflowerblue"
                                />
                                <Toy resource={toys.trucks} image={_truck} color="cadetblue" />
                            </Row>
                            <Spacer />
                            <MainDisplay
                                resource={trainedElves}
                                color="green"
                                effectDisplay={`which improve the factory tick rate by ${format(
                                    elvesEffect.value
                                )}x`}
                            />
                            {renderRow(...Object.values(elfBuyables))}
                            <Spacer />
                            {renderRow(...Object.values(factoryBuyables))}
                        </>
                    ))
                })),
                display: "Dashboard"
            }),
            factory: () => ({
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            {render(energyBar)}
                            <div class="factory-container">
                                <Factory
                                    application={app}
                                    onPointermove={onFactoryPointerMove}
                                    onPointerdown={onFactoryPointerDown}
                                    onPointerenter={onFactoryMouseEnter}
                                    onPointerleave={onFactoryMouseLeave}
                                    onContextmenu={(e: MouseEvent) => e.preventDefault()}
                                />
                                {componentsList()}
                                {hoveredComponent()}
                            </div>
                        </>
                    ))
                })),
                display: "Factory"
            })
        },
        () => ({
            classes: { "factory-tabs": true }
        })
    );

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Energy",
            modifier: energy,
            base: 0
        },
        {
            title: "Tick Rate",
            modifier: tickRate,
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

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${color}`,
        progress: () =>
            main.day.value === day
                ? Decimal.div(toys.clothes.value, toyGoal)
                      .clampMax(1)
                      .add(Decimal.div(toys.woodenBlocks.value, toyGoal).clampMax(1))
                      .add(Decimal.div(toys.trucks.value, toyGoal).clampMax(1))
                      .div(3)
                : 1,
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {
                        [toys.clothes.value, toys.woodenBlocks.value, toys.trucks.value].filter(t =>
                            Decimal.gte(t, toyGoal)
                        ).length
                    }{" "}
                    / 3
                </>
            ) : (
                ""
            )
        )
    })) as GenericBar;

    watchEffect(() => {
        if (
            main.day.value === day &&
            Decimal.gte(toys.clothes.value, toyGoal) &&
            Decimal.gte(toys.woodenBlocks.value, toyGoal) &&
            Decimal.gte(toys.trucks.value, toyGoal)
        ) {
            main.completeDay();
        }
    });

    return {
        name,
        day,
        color,
        minWidth: 700,
        minimizable: true,
        style: { overflow: "hidden" },
        components,
        elfBuyables,
        tabs,
        factoryBuyables,
        generalTabCollapsed,
        hotkeys,
        display: jsx(() => (
            <>
                {render(modifiersModal)}
                {render(tabs)}
            </>
        ))
    };
});
export default factory;
