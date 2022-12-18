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
export const size = {
    width: 1000,
    height: 345
};
const blockAmts = {
    w: 50,
    h: 17
};

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
async function createSprite(name: string) {
    const sheet = await Assets.load(name);
    return new Sprite(sheet);
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
    const isMouseHoverShown = ref(false);
    const whatIsHovered = ref<FactoryCompNames | "">("");
    const compSelected = ref<FactoryCompNames>("cursor");

    const componentData: Ref<(FactoryComponent | null)[][]> = persistent(
        Array(blockAmts.h)
            .fill(undefined)
            .map(() => Array(blockAmts.w).fill(null))
    );
    const components: (FactoryInternal | null)[][] = Array(blockAmts.h)
        .fill(undefined)
        .map(() => Array(blockAmts.w).fill(null));
    window.components = components;

    // pixi
    const app = new Application(size);
    const graphicContainer = new Graphics();
    const spriteContainer = new Container();
    const movingBlocks = new Container();
    const blockWidth = ref(app.screen.width / blockAmts.w);
    const blockHeight = ref(app.screen.height / blockAmts.h);

    graphicContainer.zIndex = 1;
    app.stage.addChild(graphicContainer, spriteContainer, movingBlocks);
    app.stage.sortableChildren = true;

    globalBus.on("update", diff => {
        blockWidth.value = app.screen.width / blockAmts.w;
        blockHeight.value = app.screen.height / blockAmts.h;

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

    globalBus.on("onLoad", async () => {
        for (const y of componentData.value.keys()) {
            for (const x of componentData.value[y].keys()) {
                changeFactoryComponent(y, x);
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
        graphicContainer.clear();
        if (isMouseHoverShown.value && compSelected.value !== "cursor") {
            const { x, y } = {
                x: roundDownTo(mouseCoords.x, blockWidth.value) / blockWidth.value,
                y: roundDownTo(mouseCoords.y, blockHeight.value) / blockHeight.value
            };
            console.log(isMouseHoverShown.value, x, y);
            graphicContainer.beginFill(components[y][x] !== null ? 0xff0000 : 0xffff00);
            graphicContainer.drawRect(
                roundDownTo(mouseCoords.x, blockWidth.value),
                roundDownTo(mouseCoords.y, blockHeight.value),
                blockWidth.value,
                blockHeight.value
            );
        }
    }
    watchEffect(updateGraphics);

    function onMouseMove(e: MouseEvent) {
        // some code to get the x and y coords relative to element
        // https://stackoverflow.com/questions/3234256/find-mouse-position-relative-to-element
        const { x, y } = getRelativeCoords(e);
        mouseCoords.x = x;
        mouseCoords.y = y;
    }
    async function onClick(e: MouseEvent) {
        const coords = getRelativeCoords(e);
        const x = roundDownTo(coords.x, blockWidth.value) / blockWidth.value;
        const y = roundDownTo(coords.y, blockHeight.value) / blockHeight.value;
        if (e.button === 0) {
            // you shouldn't be putting down a mouse
            if (compSelected.value === "cursor") return;
            // should not already be placed
            if (components[y][x] !== null) return;

            const basicData = FACTORY_COMPONENTS[compSelected.value];
            componentData.value[y][x] = {
                type: compSelected.value,
                ticksDone: 0,
                consumptionStock: Object.fromEntries(
                    Object.entries(basicData.consumptionStock).map(i => [i[0], 0])
                ),
                productionStock: Object.fromEntries(
                    Object.entries(basicData.productionStock).map(i => [i[0], 0])
                )
            };
            await changeFactoryComponent(y, x);
        } else if (e.button === 2) {
            // right click
            removeFactoryComponent(y, x);
        }
    }
    function onMouseEnter() {
        isMouseHoverShown.value = true;
    }
    function onMouseLeave() {
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
        componentData,
        display: jsx(() => (
            <div class="layer-container">
                <button class="goBack" onClick={goBack}>
                    ❌
                </button>
                <table cellspacing="0" cellpadding="0" border="0" class="container">
                    <tr>
                        <td class="info" colspan="2">
                            <div style="min-height: 3em">
                                {whatIsHovered.value !== "" ? (
                                    <>
                                        <b>{FACTORY_COMPONENTS[whatIsHovered.value].name}</b>
                                        <br />
                                        {FACTORY_COMPONENTS[whatIsHovered.value].description}
                                    </>
                                ) : undefined}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="vertical-align: top" class="comps">
                            <h3>Components</h3>
                            <div>
                                {Object.entries(FACTORY_COMPONENTS).map(value => {
                                    const key = value[0] as FactoryCompNames;
                                    const item = value[1];
                                    return (
                                        <img
                                            src={item.imageSrc}
                                            style={{
                                                width: "20%",
                                                "aspect-ratio": "1",
                                                border:
                                                    compSelected.value === key
                                                        ? "1px solid green"
                                                        : ""
                                            }}
                                            onMouseenter={() => onComponentHover(key)}
                                            onMouseleave={() => onComponentHover("")}
                                            onClick={() => onCompClick(key)}
                                        ></img>
                                    );
                                })}
                            </div>
                        </td>
                        <td
                            style={{
                                width: size.width,
                                height: size.height,
                                margin: 0,
                                padding: 0
                            }}
                        >
                            <Factory
                                application={app}
                                onMousemove={onMouseMove}
                                onMouseup={onClick}
                                onMouseenter={onMouseEnter}
                                onMouseleave={onMouseLeave}
                                onContextmenu={(e: MouseEvent) => e.preventDefault()}
                            />
                        </td>
                    </tr>
                </table>
            </div>
        ))
    };
});
export default factory;
