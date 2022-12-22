import { Application } from "@pixi/app";
import { Assets } from "@pixi/assets";
import { Container } from "@pixi/display";
import { Graphics } from "@pixi/graphics";
import { Sprite } from "@pixi/sprite";
import Spacer from "components/layout/Spacer.vue";
import { jsx } from "features/feature";
import { globalBus } from "game/events";
import { createLayer } from "game/layers";
import { noPersist, Persistent, persistent, State } from "game/persistence";
import Decimal, { format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { computed, ComputedRef, reactive, ref, watchEffect } from "vue";
import _conveyor from "./factory-components/conveyor.png";
import _cursor from "./factory-components/cursor.svg";
import _delete from "./factory-components/delete.svg";
import _rotateLeft from "./factory-components/rotateLeft.svg";
import _rotateRight from "./factory-components/rotateRight.svg";
import _wood from "./factory-components/rotate_rectangle.png";
import _block from "./factory-components/rotate_rectangle.png";
import _cloth from "./factory-components/rotate_rectangle.png";
import _dye from "./factory-components/rotate_rectangle.png";
import _clothes from "./factory-components/rotate_rectangle.png";
import _plastic from "./factory-components/rotate_rectangle.png";
import _metal from "./factory-components/rotate_rectangle.png";
import _truck from "./factory-components/rotate_rectangle.png";
import Factory from "./Factory.vue";
import "./styles/factory.css";
import coal from "./coal";
import { render } from "util/vue";
import { createTab } from "features/tabs/tab";
import { createTabFamily } from "features/tabs/tabFamily";
import { createAdditiveModifier, createSequentialModifier } from "game/modifiers";
import { main } from "data/projEntry";
import { createCollapsibleModifierSections } from "data/common";
import Modal from "components/Modal.vue";
import { createBar, GenericBar } from "features/bars/bar";
import HotkeyVue from "components/Hotkey.vue";
import { createHotkey, GenericHotkey } from "features/hotkey";

const id = "factory";

// what is the actual day?
const day = 18;

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

const factorySize = {
    width: 6,
    height: 6
};
const blockSize = 50;

const factory = createLayer(id, () => {
    // layer display
    const name = "The Factory";
    const color = "grey";

    const energy = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.add(1, coal.coal.value).log10(),
            description: "Coal Energy Production"
        }))
    ]);
    const computedEnergy = computed(() => energy.apply(0));
    const energyConsumption = computed(() =>
        Object.values(components.value)
            .map(c => FACTORY_COMPONENTS[c.type]?.energyCost ?? 0)
            .reduce((a, b) => a + b, 0)
    );
    const tickRate = computed(() =>
        Decimal.eq(energyConsumption.value, 0)
            ? 1
            : Decimal.div(energyConsumption.value, computedEnergy.value).recip().pow(2).min(1)
    );

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
                {formatWhole(energyConsumption.value)} / {formatWhole(computedEnergy.value)} energy
                used
                {Decimal.lt(tickRate.value, 1) ? (
                    <>{" (" + format(Decimal.mul(tickRate.value, 100))}% efficiency)</>
                ) : (
                    ""
                )}
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
            description: "Drag to move around.",
            tick: 0
        },
        delete: {
            imageSrc: _delete,
            key: "Backspace",
            name: "Delete",
            type: "command",
            description: "Remove components from the board.",
            tick: 0
        },
        rotateLeft: {
            imageSrc: _rotateLeft,
            key: "t",
            name: "Rotate Left",
            type: "command",
            description: "Use this to rotate components counter-clockwise.",
            tick: 0
        },
        rotateRight: {
            imageSrc: _rotateRight,
            key: "shift+t",
            name: "Rotate Right",
            type: "command",
            description: "Use this to rotate components clockwise.",
            tick: 0
        },
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
        },
        wood: {
            imageSrc: _wood,
            key: "1",
            name: "Wood Machine",
            type: "processor",
            description: "Produces 1 wood every 1 second.",
            energyCost: 10,
            tick: 1,
            outputs: {
                wood: {
                    amount: 1
                }
            }
        },
        cloth: {
            imageSrc: _cloth,
            key: "2",
            name: "Cloth Machine",
            type: "processor",
            description: "Produces 1 cloth every 1 second.",
            energyCost: 10,
            tick: 1,
            outputs: {
                cloth: {
                    amount: 1
                }
            }
        },
        dye: {
            imageSrc: _dye,
            key: "3",
            name: "Dye Machine",
            type: "processor",
            description: "Produces 1 dye every 1 second.",
            energyCost: 10,
            tick: 1,
            outputs: {
                dye: {
                    amount: 1
                }
            }
        },
        metal: {
            imageSrc: _metal,
            key: "4",
            name: "Metal Machine",
            type: "processor",
            description: "Produces 1 metal every 1 second.",
            energyCost: 10,
            tick: 1,
            outputs: {
                metal: {
                    amount: 1
                }
            }
        },
        plastic: {
            imageSrc: _plastic,
            key: "5",
            name: "Plastic Machine",
            type: "processor",
            description: "Produces 1 plastic every 1 second.",
            energyCost: 10,
            tick: 1,
            outputs: {
                plastic: {
                    amount: 1
                }
            }
        },
        blocks: {
            imageSrc: _block,
            key: "shift+1",
            name: "Wooden Block Maker",
            type: "processor",
            description: "Turns 2 wood into 1 wooden block every second.",
            energyCost: 20,
            tick: 1,
            inputs: {
                wood: {
                    amount: 2
                }
            },
            outputs: {
                block: {
                    amount: 1
                }
            }
        },
        clothes: {
            imageSrc: _clothes,
            key: "shift+2",
            name: "Clothes Maker",
            type: "processor",
            description: "Turns 2 cloth and 1 dye into 1 clothe every second.",
            energyCost: 20,
            tick: 1,
            inputs: {
                cloth: {
                    amount: 2
                },
                dye: {
                    amount: 1
                }
            },
            outputs: {
                clothes: {
                    amount: 1
                }
            }
        },
        trucks: {
            imageSrc: _truck,
            key: "shift+3",
            name: "Trucks Maker",
            type: "processor",
            description: "Turns 2 metal and 1 plastic into 1 truck every second.",
            energyCost: 20,
            tick: 1,
            inputs: {
                metal: {
                    amount: 2
                },
                plastic: {
                    amount: 1
                }
            },
            outputs: {
                trucks: {
                    amount: 1
                }
            }
        }
    } as Record<FactoryCompNames, FactoryComponentDeclaration>;
    const RESOURCES = {
        wood: _wood,
        block: _block,
        cloth: _cloth,
        dye: _dye,
        clothes: _clothes,
        plastic: _plastic,
        metal: _metal
    } as Record<string, string>;

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

    type FactoryCompNames =
        | "cursor"
        | "delete"
        | "rotateLeft"
        | "rotateRight"
        | "conveyor"
        | "wood"
        | "blocks"
        | "cloth"
        | "dye"
        | "clothes"
        | "plastic"
        | "metal"
        | "trucks";
    type BuildableCompName = Exclude<FactoryCompNames, "cursor">;

    interface FactoryComponentBase extends Record<string, State> {
        direction: Direction;
    }

    interface FactoryComponentProcessor extends FactoryComponentBase {
        type: Exclude<BuildableCompName, "conveyor">;
        inputStock?: Record<string, number>;

        // current production stock
        outputStock?: Record<string, number>;
        ticksDone: number;
    }

    interface FactoryComponentConveyor extends FactoryComponentBase {
        type: "conveyor";
    }

    type FactoryComponent = FactoryComponentBase &
        (FactoryComponentConveyor | FactoryComponentProcessor);

    interface FactoryComponentDeclaration {
        tick: number;
        key: string;
        imageSrc: string;
        name: string;
        type: "command" | "conveyor" | "processor";
        description: string;
        energyCost?: number;

        /** amount it consumes */
        inputs?: Record<
            string,
            {
                amount: number;
                capacity?: number;
            }
        >;
        /** amount it produces */
        outputs?: Record<
            string,
            {
                amount: number;
                capacity?: number;
            }
        >;

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
        type: string;
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

    const isComponentHover = ref(false);
    const whatIsHovered = ref<FactoryCompNames | "">("");

    const compSelected = ref<FactoryCompNames>("cursor");
    const components: Persistent<{ [key: string]: FactoryComponent }> = persistent({});
    const compInternalData: Record<string, FactoryInternal> = {};

    // pixi
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
        floorGraphics.beginFill(0x70645d);
        floorGraphics.drawRect(
            (-factorySize.width - 0.5) * blockSize,
            (-factorySize.height - 0.5) * blockSize,
            factorySize.width * 2 * blockSize,
            factorySize.height * 2 * blockSize
        );
        floorGraphics.endFill();
        spriteContainer.addChild(floorGraphics);

        // load every sprite here so pixi doesn't complain about loading multiple times
        await Assets.load(Object.values(FACTORY_COMPONENTS).map(x => x.imageSrc));

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
        watchEffect(updateGraphics);
    });
    (window as any).internal = compInternalData;
    (window as any).comp = components;
    (window as any).blocks = movingBlocks;

    globalBus.on("update", diff => {
        if (!loaded) return;

        const factoryTicks = Decimal.times(tickRate.value, diff).toNumber();

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

                            // empty spot
                            if (compBehind === undefined) {
                                // just delete it
                                movingBlocks.removeChild(block.sprite);
                            } else if (compBehind.type === "conveyor") {
                                // push it to the next conveyor, kill it from the
                                // curent conveyor
                                block.turbulance = Math.random() * 0.4 - 0.2;
                                (compBehind as FactoryInternalConveyor).nextPackages.push(block);
                            } else {
                                // send it to the factory
                                // destory its sprite and data
                                const factoryData = storedComp as FactoryComponentProcessor;
                                if (factoryData.inputStock !== undefined)
                                    factoryData.inputStock[block.type] = Math.min(
                                        (factoryData.inputStock[block.type] ?? 0) + 1,
                                        FACTORY_COMPONENTS[compBehind.type].inputs?.[block.type]
                                            ?.capacity ?? Infinity
                                    );
                                movingBlocks.removeChild(block.sprite);
                            }

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

                            // empty spot
                            if (compBehind === undefined) {
                                // just delete it
                                movingBlocks.removeChild(block.sprite);
                            } else if (compBehind.type === "conveyor") {
                                // push it to the next conveyor, kill it from the
                                // curent conveyor
                                block.turbulance = Math.random() * 0.4 - 0.2;
                                (compBehind as FactoryInternalConveyor).nextPackages.push(block);
                            } else {
                                // send it to the factory
                                // destory its sprite and data
                                const data = storedComp as FactoryComponentProcessor;
                                if (factoryData.inputs?.[block.type] !== undefined) {
                                    if (data.inputStock === undefined) data.inputStock = {};
                                    data.inputStock[block.type] =
                                        (data.inputStock[block.type] ?? 0) + 1;
                                }
                                movingBlocks.removeChild(block.sprite);
                            }

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
                                data.inputStock[key] = (data.inputStock[key] ?? 0) - val.amount;
                            }
                        }
                        if (factoryData.outputs !== undefined) {
                            if (data.outputStock === undefined) data.outputStock = {};
                            for (const [key, val] of Object.entries(factoryData.outputs)) {
                                data.outputStock[key] = (data.outputStock[key] ?? 0) + val.amount;
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
                let itemToMove: [string, number] | undefined = undefined;
                if (data.outputStock !== undefined) {
                    for (const [name, amt] of Object.entries(data.outputStock)) {
                        if (amt >= 1) {
                            itemToMove = [name, amt];
                            data.outputStock[name]--;
                            break;
                        }
                    }
                }
                // there is nothing to move
                if (itemToMove === undefined) continue;
                const texture = Assets.get(RESOURCES[itemToMove[0]]);
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
                sprite.height = blockSize / 5;
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
        if (x < -factorySize.width || x >= factorySize.width) return;
        if (y < -factorySize.height || y >= factorySize.height) return;

        const factoryBaseData = FACTORY_COMPONENTS[data.type];
        if (factoryBaseData == undefined) return;
        const sheet = Assets.get(factoryBaseData.imageSrc);
        const sprite = new Sprite(sheet);

        sprite.x = x * blockSize;
        sprite.y = y * blockSize;
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
                        if ((compData.inputStock?.[res] ?? 0) < val.amount) return false;
                }
                if (factoryBaseData.outputs !== undefined) {
                    for (const [res, val] of Object.entries(factoryBaseData.outputs))
                        if (
                            (compData.outputStock?.[res] ?? 0) + val.amount >
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
        compHovered = ref<FactoryComponent | undefined>(undefined);

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
                Math.max(mapOffset.x, -factorySize.width + 0.5),
                factorySize.width + 0.5
            );
            mapOffset.y = Math.min(
                Math.max(mapOffset.y, -factorySize.height + 0.5),
                factorySize.height + 0.5
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

    function onComponentMouseEnter(name: FactoryCompNames | "") {
        whatIsHovered.value = name;
        isComponentHover.value = true;
    }
    function onComponentMouseLeave() {
        isComponentHover.value = false;
    }
    function onCompClick(name: FactoryCompNames) {
        compSelected.value = name;
    }

    // ------------------------------------------------------------------------------- Tabs

    const tabs = createTabFamily(
        {
            dashboard: () => ({
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            <div>
                                {main.day.value === day
                                    ? `Do something to complete the day`
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
                                <div class="comp-container">
                                    <div
                                        class={{
                                            "comp-info": true,
                                            active: isComponentHover.value
                                        }}
                                        style={{
                                            top:
                                                Math.floor(
                                                    Math.max(
                                                        Object.keys(FACTORY_COMPONENTS).indexOf(
                                                            whatIsHovered.value
                                                        ),
                                                        0
                                                    ) / 2
                                                ) *
                                                    70 +
                                                10 +
                                                "px"
                                        }}
                                    >
                                        {whatIsHovered.value === "" ? undefined : (
                                            <>
                                                <h3>
                                                    {FACTORY_COMPONENTS[whatIsHovered.value].name}
                                                </h3>
                                                <br />
                                                {
                                                    FACTORY_COMPONENTS[whatIsHovered.value]
                                                        .description
                                                }
                                                {FACTORY_COMPONENTS[whatIsHovered.value]
                                                    .energyCost ?? 0 ? (
                                                    <>
                                                        <br />
                                                        Energy Consumption:{" "}
                                                        {formatWhole(
                                                            FACTORY_COMPONENTS[whatIsHovered.value]
                                                                .energyCost ?? 0
                                                        )}
                                                    </>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                    <div class="comp-list">
                                        {Object.entries(FACTORY_COMPONENTS).map(value => {
                                            const key = value[0] as FactoryCompNames;
                                            const item = value[1];
                                            return (
                                                <img
                                                    src={item.imageSrc}
                                                    class={{ selected: compSelected.value === key }}
                                                    onMouseenter={() => onComponentMouseEnter(key)}
                                                    onMouseleave={() => onComponentMouseLeave()}
                                                    onClick={() => onCompClick(key)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>

                                {compHovered.value !== undefined ? (
                                    <div
                                        class="info-container"
                                        id="factory-info"
                                        style={{
                                            ...(mouseCoords.x +
                                                (document.getElementById("factory-info")
                                                    ?.clientWidth ?? 0) >
                                            app.view.width - 30
                                                ? { right: app.view.width - mouseCoords.x + "px" }
                                                : { left: mouseCoords.x + "px" }),
                                            ...(mouseCoords.y +
                                                (document.getElementById("factory-info")
                                                    ?.clientHeight ?? 0) >
                                            app.view.height - 30
                                                ? { bottom: app.view.height - mouseCoords.y + "px" }
                                                : { top: mouseCoords.y + "px" })
                                        }}
                                    >
                                        <h3>{FACTORY_COMPONENTS[compHovered.value.type].name}</h3>
                                        <br />
                                        {FACTORY_COMPONENTS[compHovered.value.type].description}
                                        <br />
                                        {compHovered.value.type !== "conveyor" ? (
                                            <>
                                                {compHovered.value.inputStock !== undefined ? (
                                                    <>
                                                        <br />
                                                        <h5>Inputs:</h5>
                                                        {Object.entries(
                                                            compHovered.value.inputStock
                                                        ).map(x => (
                                                            <div>
                                                                {x[0]}: {formatWhole(x[1])}
                                                                {FACTORY_COMPONENTS[
                                                                    compHovered.value?.type ??
                                                                        "cursor"
                                                                ].inputs?.[x[0]].amount !==
                                                                undefined
                                                                    ? " / " +
                                                                      formatWhole(
                                                                          FACTORY_COMPONENTS[
                                                                              compHovered.value
                                                                                  ?.type ?? "cursor"
                                                                          ].inputs?.[x[0]].amount ??
                                                                              0
                                                                      )
                                                                    : ""}
                                                                {FACTORY_COMPONENTS[
                                                                    compHovered.value?.type ??
                                                                        "cursor"
                                                                ].inputs?.[x[0]].capacity !==
                                                                undefined
                                                                    ? " / " +
                                                                      formatWhole(
                                                                          FACTORY_COMPONENTS[
                                                                              compHovered.value
                                                                                  ?.type ?? "cursor"
                                                                          ].inputs?.[x[0]]
                                                                              .capacity ?? 0
                                                                      )
                                                                    : ""}
                                                            </div>
                                                        ))}
                                                    </>
                                                ) : undefined}
                                                {compHovered.value.outputStock !== undefined ? (
                                                    <>
                                                        <br />
                                                        <h5>Outputs:</h5>
                                                        {Object.entries(
                                                            compHovered.value.outputStock
                                                        ).map(x => (
                                                            <div>
                                                                {x[0]}: {formatWhole(x[1])}
                                                                {FACTORY_COMPONENTS[
                                                                    compHovered.value?.type ??
                                                                        "cursor"
                                                                ].outputs?.[x[0]].capacity !==
                                                                undefined
                                                                    ? " / " +
                                                                      formatWhole(
                                                                          FACTORY_COMPONENTS[
                                                                              compHovered.value
                                                                                  ?.type ?? "cursor"
                                                                          ].outputs?.[x[0]]
                                                                              .capacity ?? 0
                                                                      )
                                                                    : ""}
                                                            </div>
                                                        ))}
                                                    </>
                                                ) : undefined}
                                            </>
                                        ) : undefined}
                                    </div>
                                ) : undefined}
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
        progress: () => (main.day.value === day ? 0 : 1),
        display: jsx(() => (main.day.value === day ? <>Requirement progress here</> : ""))
    })) as GenericBar;

    watchEffect(() => {
        if (main.day.value === day && false) {
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
        tabs,
        generalTabCollapsed,
        modifiersModal,
        hotkeys,
        display: jsx(() => <>{render(tabs)}</>)
    };
});
export default factory;
