import { jsx } from "features/feature";
import { createLayer } from "game/layers";

const id = "elves";

// what is the actual day?
const day = 20;
const factory = createLayer(id, () => {
    const name = "The Factory";
    const color = "grey";
    return {
        name,
        day,
        color,
        display: jsx(() => <>testing testing 1 2 3</>)
    };
})
export default factory;
