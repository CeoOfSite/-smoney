/**
 * CS2 inspect link decoder for float values and Doppler phase detection.
 *
 * Uses @csfloat/cs2-inspect-serializer to decode CS2 inspect links locally.
 * CS2 inspect links now self-encode item properties (float, paint index, etc.),
 * so no external API calls are needed.
 */

import { decodeLink } from "@csfloat/cs2-inspect-serializer";

const PAINT_INDEX_PHASE: Record<number, string> = {
  415: "Ruby",
  416: "Sapphire",
  417: "Black Pearl",
  418: "Phase 1",
  419: "Phase 2",
  420: "Phase 3",
  421: "Phase 4",
  568: "Emerald",
  569: "Phase 1",
  570: "Phase 2",
  571: "Phase 3",
  572: "Phase 4",
};

export interface InspectData {
  floatValue: number;
  paintIndex: number;
  paintSeed: number;
}

export function decodeInspectLink(inspectLink: string): InspectData | null {
  try {
    const decoded = decodeLink(inspectLink);
    if (!decoded) return null;

    return {
      floatValue: decoded.paintwear ?? 0,
      paintIndex: decoded.paintindex ?? 0,
      paintSeed: decoded.paintseed ?? 0,
    };
  } catch {
    // New CS2 hex-encoded links decode above; old S/A/D format links fail.
    // Try extracting the D parameter and decoding it as hex.
    try {
      const dMatch = /D([0-9A-Fa-f]{10,})/.exec(inspectLink);
      if (dMatch) {
        const { decodeHex } = require("@csfloat/cs2-inspect-serializer") as {
          decodeHex: (hex: string) => { paintwear?: number; paintindex?: number; paintseed?: number };
        };
        const decoded = decodeHex(dMatch[1]);
        if (decoded) {
          return {
            floatValue: decoded.paintwear ?? 0,
            paintIndex: decoded.paintindex ?? 0,
            paintSeed: decoded.paintseed ?? 0,
          };
        }
      }
    } catch {
      // D param is decimal (old format), can't decode locally
    }
    return null;
  }
}

export function phaseFromPaintIndex(
  paintIndex: number | null | undefined,
  itemName: string,
): string | null {
  if (paintIndex == null) return null;
  if (!itemName.toLowerCase().includes("doppler")) return null;
  return PAINT_INDEX_PHASE[paintIndex] ?? null;
}

interface EnrichableItem {
  assetId: string;
  inspectLink: string | null;
  marketHashName: string;
  floatValue: number | null;
  phaseLabel: string | null;
}

/**
 * Enrich items with float values and Doppler phases by decoding inspect links.
 * Mutates items in-place. Returns the number of items enriched.
 */
export function enrichFromInspectLinks(items: EnrichableItem[]): number {
  let count = 0;
  for (const item of items) {
    if (!item.inspectLink) continue;

    const data = decodeInspectLink(item.inspectLink);
    if (!data) continue;

    if (data.floatValue > 0) {
      item.floatValue = data.floatValue;
    }

    const phase = phaseFromPaintIndex(data.paintIndex, item.marketHashName);
    if (phase) {
      item.phaseLabel = phase;
    }

    count++;
  }

  const withFloat = items.filter((i) => i.floatValue != null && i.floatValue > 0).length;
  const withPhase = items.filter((i) => i.phaseLabel != null).length;
  const withInspect = items.filter((i) => i.inspectLink).length;
  console.log(
    `[csfloat] inspect decode: total=${items.length}, with_inspect=${withInspect}, decoded=${count}, with_float=${withFloat}, with_phase=${withPhase}`,
  );
  if (withInspect > 0 && count === 0) {
    const sample = items.find((i) => i.inspectLink);
    if (sample) {
      console.log(`[csfloat] sample inspect link: ${sample.inspectLink?.slice(0, 200)}`);
    }
  }

  return count;
}
