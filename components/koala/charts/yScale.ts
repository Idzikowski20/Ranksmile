import { scaleLinear } from '@visx/scale';

type YScale = ReturnType<typeof scaleLinear<number>>;

/** Domain for one series — zero-baseline for counts; rank uses raw range + reverse. */
export function buildSeriesYScale(
  values: Array<number | null>,
  innerHeight: number,
  opts: { reverse: boolean; zeroBaseline: boolean },
): YScale {
  const nums = values.filter((v): v is number => v != null);
  const dataMin = nums.length ? Math.min(...nums) : 0;
  const dataMax = nums.length ? Math.max(...nums) : 1;
  const min = opts.zeroBaseline ? Math.min(0, dataMin) : dataMin;
  const max = dataMax <= min ? min + 1 : dataMax;
  return scaleLinear<number>({
    domain: opts.reverse ? [max, min] : [min, max],
    range: [innerHeight, 0],
    nice: true,
  });
}
