/** Minimal subset of the Tiled JSON format (https://doc.mapeditor.org/en/stable/reference/json-map-format/). */
export interface TiledProperty {
  name: string;
  type: string;
  value: string | number | boolean;
}

export interface TiledObject {
  id: number;
  name: string;
  type?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  properties?: TiledProperty[];
}

export interface TiledTileLayer {
  id: number;
  name: string;
  type: 'tilelayer';
  width: number;
  height: number;
  data: number[];
}

export interface TiledObjectLayer {
  id: number;
  name: string;
  type: 'objectgroup';
  objects: TiledObject[];
}

export interface TiledTileset {
  firstgid: number;
  name: string;
  image: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
  tiles?: { id: number; properties?: TiledProperty[] }[];
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: (TiledTileLayer | TiledObjectLayer | { type: string; name: string })[];
  tilesets: TiledTileset[];
}
