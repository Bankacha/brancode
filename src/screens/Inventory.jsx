import ListDetail from "./ListDetail.jsx";
import { popisScreen } from "./listScreens.js";

// /popis/:id
export default function Inventory() {
  return <ListDetail screen={popisScreen} />;
}
