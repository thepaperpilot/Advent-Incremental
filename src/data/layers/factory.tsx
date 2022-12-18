import { jsx } from "features/feature";
import { createLayer } from "game/layers";
import { Application } from "@pixi/app";
import { Sprite } from "@pixi/sprite";
import { Graphics } from "@pixi/graphics";
import { Assets } from "@pixi/assets";
import Factory from "./Factory.vue";
import conveyor from "./factory-components/conveyor.png";
import cursor from "./factory-components/cursor.jpg";
import square from "./factory-components/square.jpg";
import { computed, ComputedRef, reactive, Ref, ref, watchEffect } from "vue";
import { Direction } from "util/common";
import { persistent } from "game/persistence";
import player from "game/player";
import "./styles/factory.css";
import { globalBus } from "game/events";
import { Container } from "@pixi/display";
import { Matrix } from "@pixi/math";

const id = "factory";

// what is the actual day?
const day = 20;

// 20x20 block size
// TODO: unhardcode stuff

enum FactoryDirections {
    Any,
    None
}
type FactoryDirection = FactoryDirections | Direction;

function roundDownTo(num: number, multiple: number) {
    return Math.floor(num / multiple) * multiple;
}
function getRelativeCoords(e: MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

const blockSize = 50;

interface FactoryComponent {
    directionIn: Direction | undefined;
    directionOut: Direction | undefined;
    imageSrc: string;
    name: string;
    description: string;
    type: string;
    sprite: Sprite;
}

async function positionSprite(name: string, y: number, x: number, width: number, height: number) {
    const sprite = await createSprite(name);
    sprite.width = width;
    sprite.height = height;
    sprite.y = y;
    sprite.x = x;
    return sprite;
}

const factory = createLayer(id, () => {
    // layer display
    const name = "The Factory";
    const color = "grey";

    const FACTORY_COMPONENTS = {
        cursor: {
            imageSrc: cursor,
            name: "Cursor",
            description: "Use this to move.",
            tick: 0,
            directionIn: FactoryDirections.None,
            directionOut: FactoryDirections.None,
            consumption: {},
            consumptionStock: {},
            production: {},
            productionStock: {}
        },
        conveyor: {
            directionIn: FactoryDirections.Any,
            directionOut: FactoryDirections.Any,
            imageSrc: conveyor,
            name: "Conveyor",
            description: "Moves 1 item per tick.",
            tick: 1,
            consumption: {},
            consumptionStock: {},
            production: {},
            productionStock: {}
        },
        square: {
            directionIn: FactoryDirections.Any,
            directionOut: FactoryDirections.None,
            imageSrc: square,
            name: "???",
            description: "Produces 1 square every 1 tick.",
            tick: 1,
            production: {
                square: 1
            },
            productionStock: {
                square: Infinity
            },
            consumption: {},
            consumptionStock: {},
            onProduce(times) {
            }
        }
    } as Record<string, FactoryComponentDeclaration>;

    type FactoryCompNames = keyof typeof FACTORY_COMPONENTS;
    type BuildableCompName = Exclude<FactoryCompNames, "cursor">;

    interface FactoryComponent {
        type: BuildableCompName;
        ticksDone: number;
        // current consumption stock
        consumptionStock: Record<string, number>;

        // current production stock
        productionStock: Record<string, number>;
    }
    interface FactoryComponentDeclaration {
        tick: number;
        directionIn: FactoryDirection;
        directionOut: FactoryDirection;
        imageSrc: string;
        name: string;
        description: string;

        // amount it consumes
        consumption: Record<string, number>;
        // maximum stock of consumption
        consumptionStock: Record<string, number>;
        // amount it produces
        production: Record<string, number>;
        // maximum stock of production
        productionStock: Record<string, number>;

        // on produce, do something
        onProduce?: (times: number) => void;
        // can it produce? (in addtion to the stock check)
        canProduce?: ComputedRef<boolean>;
    }

    interface FactoryInternal {
        sprite: Sprite;
        canProduce: ComputedRef<boolean>;
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
    const whatIsHovered = ref<FactoryCompNames | "">("");
    const compSelected = ref<FactoryCompNames>("cursor");
    const components: Ref<unknown[][]> = persistent(
        Array(blockAmts.h)
            .fill(undefined)
            .map(() => Array(blockAmts.w).fill(undefined))
    );

    // pixi
    const app = new Application({
        backgroundAlpha: 0
    });
    const graphicContainer = new Graphics();
    const spriteContainer = new Container();
    const movingBlocks = new Container();

    graphicContainer.zIndex = 1;
    app.stage.addChild(graphicContainer, spriteContainer, movingBlocks);
    app.stage.sortableChildren = true;

    globalBus.on("update", diff => {

        // will change soon:tm:
        const tick = diff;
        for (const y of components.keys()) {
            for (const x of components[y].keys()) {
                const data = componentData.value[y][x];
                const compData = components[y][x];
                //console.log(compData, data)
                if (data === null || compData === null) continue;
                const factoryData = FACTORY_COMPONENTS[data.type];
                if (data.ticksDone >= factoryData.tick) {
                    console.log(compData.canProduce);
                    if (!compData.canProduce.value) continue;
                    const cyclesDone = Math.floor(data.ticksDone / factoryData.tick);
                    console.log("produce", data.ticksDone, factoryData.tick);
                    factoryData.onProduce?.(cyclesDone);
                    for (const [key, val] of Object.entries(factoryData.consumption)) {
                        data.consumptionStock[key] -= val;
                    }
                    for (const [key, val] of Object.entries(factoryData.production)) {
                        data.productionStock[key] -= val;
                    }
                    data.ticksDone -= cyclesDone * factoryData.tick;
                } else {
                    data.ticksDone += tick;
                }
            }
        }
    });



    async function changeFactoryComponent(y: number, x: number) {
        const comp = componentData.value[y][x];
        if (comp === null) return;
        const data = FACTORY_COMPONENTS[comp.type];
        const sprite = await positionSprite(
            FACTORY_COMPONENTS[comp.type].imageSrc,
            y * blockHeight.value,
            x * blockWidth.value,
            blockWidth.value,
            blockHeight.value
        );
        components[y][x] = {
            sprite,
            canProduce: computed(() => {
                if (!(data.canProduce?.value ?? true)) return false;
                for (const [key, res] of Object.entries(comp.productionStock)) {
                    // if the current stock + production is more than you can handle
                    if (res + data.production[key] > data.productionStock[key]) return false;
                }
                for (const [key, res] of Object.entries(comp.consumptionStock)) {
                    // make sure you have enough to produce
                    if (res < data.consumptionStock[key]) return false;
                }
                return true;
            })
        };
        spriteContainer.addChild(sprite);
    }

    function removeFactoryComponent(y: number, x: number) {
        const comp = components[y][x];
        if (comp === null) return;
        comp.sprite.destroy();
        componentData.value[y][x] = null;
        components[y][x] = null;
        spriteContainer.removeChild(comp.sprite);
    }

    // draw graphics
    function updateGraphics() {
        app.resize();
        graphicContainer.clear();
        
        spriteContainer.x = mapOffset.x * blockSize + app.view.width / 2;
        spriteContainer.y = mapOffset.y * blockSize + app.view.height / 2;
        
        if (isMouseHoverShown.value) {
            let { tx, ty } = spriteContainer.localTransform;
            graphicContainer.beginFill(0x808080);
            graphicContainer.drawRect(
                roundDownTo(mouseCoords.x - tx, blockSize) + tx,
                roundDownTo(mouseCoords.y - ty, blockSize) + ty,
                blockSize,
                blockSize
            );
        }
    }
    watchEffect(updateGraphics);

    let pointerDown = ref(false), pointerDrag = ref(false);

    function onFactoryPointerMove(e: PointerEvent) {

        const { x, y } = getRelativeCoords(e);
        mouseCoords.x = x;
        mouseCoords.y = y;

        if (pointerDown.value && (pointerDrag.value || Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2)) {
            pointerDrag.value = true;
            mapOffset.x += e.movementX / blockSize;
            mapOffset.y += e.movementY / blockSize;
        }
    }
    async function onFactoryPointerDown(e: PointerEvent) {
        window.addEventListener("pointerup", onFactoryPointerUp);
        pointerDown.value = true;
    }
    async function onFactoryPointerUp(e: PointerEvent) {
        if (!pointerDrag.value) {
            if (compSelected.value !== "") {
                let { tx, ty } = spriteContainer.localTransform;
                let { x, y } = getRelativeCoords(e);
                x = roundDownTo(x - tx, blockSize) / blockSize;
                y = roundDownTo(y - ty, blockSize) / blockSize;

                const basicData = structuredClone(
                    FACTORY_COMPONENTS[compSelected.value]
                ) as FactoryComponent;
                basicData.type = compSelected.value;
                const sheet = await Assets.load(basicData.imageSrc);
                basicData.sprite = new Sprite(sheet);

                basicData.sprite.x = x * blockSize;
                basicData.sprite.y = y * blockSize;
                basicData.sprite.width = blockSize;
                basicData.sprite.height = blockSize;
                spriteContainer.addChild(basicData.sprite);
            }
        }

        window.removeEventListener("pointerup", onFactoryPointerUp);
        pointerDown.value = pointerDrag.value = false;
    }
    function onFactoryMouseEnter() {
        isMouseHoverShown.value = true;
    }
    function onFactoryMouseLeave() {
        isMouseHoverShown.value = false;
    }

    function goBack() {
        player.tabs.splice(0, Infinity, "main");
    }
    function onComponentHover(name: FactoryCompNames | "") {
        if (compSelected.value !== "cursor") return;
        whatIsHovered.value = name;
    }
    function onCompClick(name: FactoryCompNames) {
        compSelected.value = name;
    }
    return {
        name,
        day,
        color,
        minWidth: 700,
        minimizable: false,
        style: { overflow: "hidden" },
        display: jsx(() => (
            <div class="layer-container">
                <button class="goBack" onClick={goBack}>
                    ❌
                </button>
                <Factory
                    application={app}
                    onPointermove={onFactoryPointerMove}
                    onPointerdown={onFactoryPointerDown}
                    onPointerenter={onFactoryMouseEnter}
                    onPointerleave={onFactoryMouseLeave}
                />
                <div cellspacing="0" cellpadding="0" border="0" class="container">
                    <div style="line-height: 2.5em; min-height: 2.5em">
                        {whatIsHovered.value === ""
                            ? undefined
                            : FACTORY_COMPONENTS[whatIsHovered.value].description}
                    </div>
                    <div class="comps">
                        <div>
                            {Object.entries(FACTORY_COMPONENTS).map(value => {
                                const key = value[0] as FactoryCompNames;
                                const item = value[1];
                                return (
                                    <img
                                        src={item.imageSrc}
                                        class={{ selected: compSelected.value === key }}
                                        onMouseenter={() => onComponentHover(key)}
                                        onMouseleave={() => onComponentHover("")}
                                        onClick={() => onCompClick(key)}
                                    ></img>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        ))
    };
});
export default factory;
