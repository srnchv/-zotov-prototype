import { gridMetadata, GridPage } from "../grid";
export const revalidate = 3600; // страница из кэша; сброс — из админки при сохранении (/api/revalidate), страховка — раз в час
export const generateMetadata = () => gridMetadata("project");
export default function Page() { return <GridPage kind="project" />; }
