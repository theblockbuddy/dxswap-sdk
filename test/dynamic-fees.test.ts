import JSBI from 'jsbi'
import { ChainId, Pair, Percent, Route, Token, TokenAmount, Trade, TradeType } from '../src'
import { defaultSwapFee, defaultProtocolFeeDenominator } from '../src/constants'

describe('Dynamic-Fees', () => {
  const token0 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 't0')
  const token1 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 't1')
  const token2 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000003', 18, 't2')
  const token3 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000004', 18, 't3')

  const pair_0_1 = new Pair(new TokenAmount(token0, JSBI.BigInt(1000)), new TokenAmount(token1, JSBI.BigInt(1000)), JSBI.BigInt(0), JSBI.BigInt(0))
  const pair_0_2 = new Pair(new TokenAmount(token0, JSBI.BigInt(1000)), new TokenAmount(token2, JSBI.BigInt(1100)), JSBI.BigInt(15), JSBI.BigInt(5))
  const pair_0_3 = new Pair(new TokenAmount(token0, JSBI.BigInt(1000)), new TokenAmount(token3, JSBI.BigInt(900)), JSBI.BigInt(30), JSBI.BigInt(0))
  const pair_1_2 = new Pair(new TokenAmount(token1, JSBI.BigInt(1200)), new TokenAmount(token2, JSBI.BigInt(1000)), JSBI.BigInt(0), JSBI.BigInt(5))
  const pair_1_3 = new Pair(new TokenAmount(token1, JSBI.BigInt(1200)), new TokenAmount(token3, JSBI.BigInt(1300)), defaultSwapFee, defaultProtocolFeeDenominator)

  const empty_pair_0_1 = new Pair(new TokenAmount(token0, JSBI.BigInt(0)), new TokenAmount(token1, JSBI.BigInt(0)))

  describe('#bestTradeExactIn', () => {
    it('throws with empty pairs', () => {
      expect(() => Trade.bestTradeExactIn([], new TokenAmount(token0, JSBI.BigInt(100)), token2)).toThrow('PAIRS')
    })
    it('throws with max hops of 0', () => {
      expect(() =>
        Trade.bestTradeExactIn([pair_0_2], new TokenAmount(token0, JSBI.BigInt(100)), token2, { maxHops: 0 })
      ).toThrow('MAX_HOPS')
    })

    it('provides best route', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_2, pair_1_2],
        new TokenAmount(token0, JSBI.BigInt(100)),
        token2
      )
      expect(result).toHaveLength(2)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.path).toEqual([token0, token2])
      expect(result[0].inputAmount).toEqual(new TokenAmount(token0, JSBI.BigInt(100)))
      expect(result[0].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(99)))
      expect(result[1].route.pairs).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
      expect(result[1].route.path).toEqual([token0, token1, token2])
      expect(result[1].inputAmount).toEqual(new TokenAmount(token0, JSBI.BigInt(100)))
      expect(result[1].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(69)))
    })

    it('doesnt throw for zero liquidity pairs', () => {
      expect(Trade.bestTradeExactIn([empty_pair_0_1], new TokenAmount(token0, JSBI.BigInt(100)), token1)).toHaveLength(
        0
      )
    })

    it('respects maxHops', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_2, pair_1_2],
        new TokenAmount(token0, JSBI.BigInt(10)),
        token2,
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.path).toEqual([token0, token2])
    })

    it('insufficient input for one pair', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_2, pair_1_2],
        new TokenAmount(token0, JSBI.BigInt(1)),
        token2
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.path).toEqual([token0, token2])
      expect(result[0].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(1)))
    })

    it('respects n', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_2, pair_1_2],
        new TokenAmount(token0, JSBI.BigInt(10)),
        token2,
        { maxNumResults: 1 }
      )

      expect(result).toHaveLength(1)
    })

    it('no path', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_3, pair_1_3],
        new TokenAmount(token0, JSBI.BigInt(10)),
        token2
      )
      expect(result).toHaveLength(0)
    })
  })

  describe('#maximumAmountIn', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = new Trade(
        new Route([pair_0_1, pair_1_2], token0),
        new TokenAmount(token0, JSBI.BigInt(100)),
        TradeType.EXACT_INPUT
      )
      it('throws if less than 0', () => {
        expect(() => exactIn.maximumAmountIn(new Percent(JSBI.BigInt(-1), JSBI.BigInt(100)))).toThrow(
          'SLIPPAGE_TOLERANCE'
        )
      })
      it('returns exact if 0', () => {
        expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(exactIn.inputAmount)
      })
      it('returns exact if nonzero', () => {
        expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, JSBI.BigInt(100))
        )
        expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, JSBI.BigInt(100))
        )
        expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, JSBI.BigInt(100))
        )
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = new Trade(
        new Route([pair_0_1, pair_1_2], token0),
        new TokenAmount(token2, JSBI.BigInt(100)),
        TradeType.EXACT_OUTPUT
      )

      it('throws if less than 0', () => {
        expect(() => exactOut.maximumAmountIn(new Percent(JSBI.BigInt(-1), JSBI.BigInt(100)))).toThrow(
          'SLIPPAGE_TOLERANCE'
        )
      })
      it('returns exact if 0', () => {
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(exactOut.inputAmount)
      })
      it('returns slippage amount if nonzero', () => {
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, JSBI.BigInt(155))
        )
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, JSBI.BigInt(162))
        )
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, JSBI.BigInt(465))
        )
      })
    })
  })

  describe('#minimumAmountOut', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = new Trade(
        new Route([pair_0_1, pair_1_2], token0),
        new TokenAmount(token0, JSBI.BigInt(100)),
        TradeType.EXACT_INPUT
      )
      it('throws if less than 0', () => {
        expect(() => exactIn.minimumAmountOut(new Percent(JSBI.BigInt(-1), JSBI.BigInt(100)))).toThrow(
          'SLIPPAGE_TOLERANCE'
        )
      })
      it('returns exact if 0', () => {
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(exactIn.outputAmount)
      })
      it('returns exact if nonzero', () => {
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token2, JSBI.BigInt(69))
        )
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token2, JSBI.BigInt(65))
        )
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token2, JSBI.BigInt(23))
        )
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = new Trade(
        new Route([pair_0_1, pair_1_2], token0),
        new TokenAmount(token2, JSBI.BigInt(100)),
        TradeType.EXACT_OUTPUT
      )

      it('throws if less than 0', () => {
        expect(() => exactOut.minimumAmountOut(new Percent(JSBI.BigInt(-1), JSBI.BigInt(100)))).toThrow(
          'SLIPPAGE_TOLERANCE'
        )
      })
      it('returns exact if 0', () => {
        expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(exactOut.outputAmount)
      })
      it('returns slippage amount if nonzero', () => {
        expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token2, JSBI.BigInt(100))
        )
        expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token2, JSBI.BigInt(100))
        )
        expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token2, JSBI.BigInt(100))
        )
      })
    })
  })

  describe('#bestTradeExactOut', () => {
    it('throws with empty pairs', () => {
      expect(() => Trade.bestTradeExactOut([], token0, new TokenAmount(token2, JSBI.BigInt(100)))).toThrow('PAIRS')
    })
    it('throws with max hops of 0', () => {
      expect(() =>
        Trade.bestTradeExactOut([pair_0_2], token0, new TokenAmount(token2, JSBI.BigInt(100)), { maxHops: 0 })
      ).toThrow('MAX_HOPS')
    })

    it('provides best route', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_2, pair_1_2],
        token0,
        new TokenAmount(token2, JSBI.BigInt(100))
      )
      expect(result).toHaveLength(2)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.path).toEqual([token0, token2])
      expect(result[0].inputAmount).toEqual(new TokenAmount(token0, JSBI.BigInt(101)))
      expect(result[0].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(100)))
      expect(result[1].route.pairs).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
      expect(result[1].route.path).toEqual([token0, token1, token2])
      expect(result[1].inputAmount).toEqual(new TokenAmount(token0, JSBI.BigInt(155)))
      expect(result[1].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(100)))
    })

    it('doesnt throw for zero liquidity pairs', () => {
      expect(Trade.bestTradeExactOut([empty_pair_0_1], token1, new TokenAmount(token1, JSBI.BigInt(100)))).toHaveLength(
        0
      )
    })

    it('respects maxHops', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_2, pair_1_2],
        token0,
        new TokenAmount(token2, JSBI.BigInt(10)),
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.path).toEqual([token0, token2])
    })

    it('insufficient liquidity', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_2, pair_1_2],
        token0,
        new TokenAmount(token2, JSBI.BigInt(1200))
      )
      expect(result).toHaveLength(0)
    })

    it('insufficient liquidity in one pair but not the other', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_2, pair_1_2],
        token0,
        new TokenAmount(token2, JSBI.BigInt(1050))
      )
      expect(result).toHaveLength(1)
    })

    it('respects n', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_2, pair_1_2],
        token0,
        new TokenAmount(token2, JSBI.BigInt(10)),
        { maxNumResults: 1 }
      )

      expect(result).toHaveLength(1)
    })

    it('no path', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_3, pair_1_3],
        token0,
        new TokenAmount(token2, JSBI.BigInt(10))
      )
      expect(result).toHaveLength(0)
    })
  })
})
