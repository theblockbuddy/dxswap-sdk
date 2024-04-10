export interface TokenInfo {
  readonly chainId: number
  readonly address: string
  readonly name: string
  readonly decimals: number
  readonly symbol: string
  readonly logoURI: string
}

export interface TokenList {
  readonly name: string
  readonly tokens: TokenInfo[]
}
