type SerializedBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BoundVariable = {
  id: string;
  name: string;
  collectionName: string;
};

type SerializedNode = {
  id: string;
  name: string;
  type: string;
  bounds?: SerializedBounds;
  characters?: string;
  styles?: Record<string, unknown>;
  boundVariables?: Record<string, BoundVariable | BoundVariable[]>;
  children?: SerializedNode[];
  childCount?: number;
};

const isMixed = (value: unknown): value is symbol => typeof value === "symbol";

const toHex = (color: RGB): string => {
  const clamp = (value: number) =>
    Math.min(255, Math.max(0, Math.round(value * 255)));
  const [r, g, b] = [clamp(color.r), clamp(color.g), clamp(color.b)];
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const serializePaints = (paints: readonly Paint[] | symbol | undefined) => {
  if (isMixed(paints) || !paints || !Array.isArray(paints)) {
    return isMixed(paints) ? "mixed" : [];
  }
  return paints
    .filter((paint) => paint.type === "SOLID" && "color" in paint)
    .map((paint) => ({
      type: paint.type,
      color: paint.type === "SOLID" ? toHex(paint.color) : undefined,
      opacity: paint.opacity,
    }));
};

const getBounds = (node: SceneNode): SerializedBounds | undefined => {
  if ("x" in node && "y" in node && "width" in node && "height" in node) {
    return {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
  }
  return undefined;
};

const serializeLineHeight = (
  lineHeight: LineHeight | symbol
): unknown => {
  if (isMixed(lineHeight)) return "mixed";
  if (lineHeight.unit === "AUTO") return "auto";
  return { value: lineHeight.value, unit: lineHeight.unit };
};

const serializeLetterSpacing = (
  letterSpacing: LetterSpacing | symbol
): unknown => {
  if (isMixed(letterSpacing)) return "mixed";
  return { value: letterSpacing.value, unit: letterSpacing.unit };
};

const serializeText = (node: TextNode, base: SerializedNode) => {
  let font: string | undefined;
  let fontStyle: string | undefined;
  if (typeof node.fontName === "symbol") {
    font = "mixed";
    fontStyle = "mixed";
  } else if (node.fontName) {
    font = node.fontName.family;
    fontStyle = node.fontName.style;
  }
  return {
    ...base,
    characters: node.characters,
    styles: {
      ...base.styles,
      fontSize: isMixed(node.fontSize) ? "mixed" : node.fontSize,
      fontFamily: font,
      fontStyle,
      lineHeight: serializeLineHeight(node.lineHeight),
      letterSpacing: serializeLetterSpacing(node.letterSpacing),
      textAlignHorizontal: isMixed(node.textAlignHorizontal)
        ? "mixed"
        : node.textAlignHorizontal,
      textAlignVertical: isMixed(node.textAlignVertical)
        ? "mixed"
        : node.textAlignVertical,
      textDecoration: isMixed(node.textDecoration)
        ? "mixed"
        : node.textDecoration,
      textCase: isMixed(node.textCase) ? "mixed" : node.textCase,
      paragraphSpacing: isMixed(node.paragraphSpacing)
        ? "mixed"
        : node.paragraphSpacing,
    },
  };
};

const serializeEffects = (effects: readonly Effect[] | symbol | undefined) => {
  if (isMixed(effects) || !effects || !Array.isArray(effects)) {
    return isMixed(effects) ? "mixed" : [];
  }
  return effects.map((effect) => {
    const base: Record<string, unknown> = {
      type: effect.type,
      visible: effect.visible,
    };
    if ("radius" in effect) base.radius = effect.radius;
    if ("spread" in effect) base.spread = effect.spread;
    if ("offset" in effect) base.offset = effect.offset;
    if ("color" in effect && effect.color) {
      base.color = toHex(effect.color);
      base.opacity = effect.color.a;
    }
    if ("blendMode" in effect) base.blendMode = effect.blendMode;
    return base;
  });
};

const serializeStyles = (node: SceneNode) => {
  const styles: Record<string, unknown> = {};

  // Visibility & blend
  if ("visible" in node) styles.visible = node.visible;
  if ("opacity" in node) styles.opacity = node.opacity;
  if ("blendMode" in node) styles.blendMode = node.blendMode;

  // Fills & strokes
  if ("fills" in node) styles.fills = serializePaints(node.fills);
  if ("strokes" in node) styles.strokes = serializePaints(node.strokes);
  if ("strokeWeight" in node) {
    styles.strokeWeight = isMixed(node.strokeWeight)
      ? "mixed"
      : node.strokeWeight;
  }
  if ("strokeAlign" in node) styles.strokeAlign = node.strokeAlign;
  if ("dashPattern" in node && node.dashPattern.length > 0) {
    styles.dashPattern = node.dashPattern;
  }

  // Corner radius
  if ("cornerRadius" in node) {
    styles.cornerRadius = isMixed(node.cornerRadius)
      ? "mixed"
      : node.cornerRadius;
  }
  if (
    "topLeftRadius" in node &&
    isMixed((node as any).cornerRadius)
  ) {
    styles.topLeftRadius = (node as any).topLeftRadius;
    styles.topRightRadius = (node as any).topRightRadius;
    styles.bottomLeftRadius = (node as any).bottomLeftRadius;
    styles.bottomRightRadius = (node as any).bottomRightRadius;
  }

  // Effects (shadows, blurs)
  if ("effects" in node) {
    const effects = serializeEffects(node.effects);
    if (Array.isArray(effects) && effects.length > 0) {
      styles.effects = effects;
    }
  }

  // Auto-layout
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    styles.layoutMode = node.layoutMode;
    styles.primaryAxisAlignItems = node.primaryAxisAlignItems;
    styles.counterAxisAlignItems = node.counterAxisAlignItems;
    styles.itemSpacing = node.itemSpacing;
    if ("counterAxisSpacing" in node && node.counterAxisSpacing !== null) {
      styles.counterAxisSpacing = node.counterAxisSpacing;
    }
    styles.layoutWrap = node.layoutWrap;
  }
  if ("paddingLeft" in node) {
    styles.padding = {
      top: node.paddingTop,
      right: node.paddingRight,
      bottom: node.paddingBottom,
      left: node.paddingLeft,
    };
  }

  // Sizing
  if ("layoutSizingHorizontal" in node) {
    styles.layoutSizingHorizontal = node.layoutSizingHorizontal;
    styles.layoutSizingVertical = node.layoutSizingVertical;
  }
  if ("minWidth" in node && node.minWidth !== null) styles.minWidth = node.minWidth;
  if ("maxWidth" in node && node.maxWidth !== null) styles.maxWidth = node.maxWidth;
  if ("minHeight" in node && node.minHeight !== null) styles.minHeight = node.minHeight;
  if ("maxHeight" in node && node.maxHeight !== null) styles.maxHeight = node.maxHeight;

  // Positioning
  if ("layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE") {
    styles.layoutPositioning = node.layoutPositioning;
  }

  // Clipping & rotation
  if ("clipsContent" in node) styles.clipsContent = node.clipsContent;
  if ("rotation" in node && node.rotation !== 0) styles.rotation = node.rotation;

  return styles;
};

type VariableCache = {
  variables: Map<string, Variable | null>;
  collections: Map<string, VariableCollection | null>;
};

const createVariableCache = (): VariableCache => ({
  variables: new Map(),
  collections: new Map(),
});

const resolveVariable = async (
  id: string,
  cache: VariableCache
): Promise<BoundVariable | null> => {
  if (!cache.variables.has(id)) {
    cache.variables.set(
      id,
      await figma.variables.getVariableByIdAsync(id)
    );
  }
  const variable = cache.variables.get(id);
  if (!variable) return null;

  const collectionId = variable.variableCollectionId;
  if (!cache.collections.has(collectionId)) {
    cache.collections.set(
      collectionId,
      await figma.variables.getVariableCollectionByIdAsync(collectionId)
    );
  }
  const collection = cache.collections.get(collectionId);

  return {
    id: variable.id,
    name: variable.name,
    collectionName: collection?.name ?? "Unknown",
  };
};

const serializeBoundVariables = async (
  node: SceneNode,
  cache: VariableCache
): Promise<Record<string, BoundVariable | BoundVariable[]> | undefined> => {
  if (!("boundVariables" in node) || !node.boundVariables) return undefined;

  const bound = node.boundVariables as Record<
    string,
    VariableAlias | VariableAlias[]
  >;
  const entries = Object.entries(bound);
  if (entries.length === 0) return undefined;

  const result: Record<string, BoundVariable | BoundVariable[]> = {};

  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      const resolved = (
        await Promise.all(value.map((alias) => resolveVariable(alias.id, cache)))
      ).filter((v): v is BoundVariable => v !== null);
      if (resolved.length > 0) result[key] = resolved;
    } else if (value && "id" in value) {
      const resolved = await resolveVariable(value.id, cache);
      if (resolved) result[key] = resolved;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

export const serializeNode = async (
  node: SceneNode,
  cache?: VariableCache
): Promise<SerializedNode> => {
  const vc = cache ?? createVariableCache();

  const base: SerializedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    bounds: getBounds(node),
    styles: serializeStyles(node),
    boundVariables: await serializeBoundVariables(node, vc),
  };

  if (node.type === "TEXT") {
    return serializeText(node, base);
  }

  if ("children" in node) {
    return {
      ...base,
      children: await Promise.all(
        node.children.map((child) => serializeNode(child, vc))
      ),
    };
  }

  return base;
};
