import type { LanguageCode, SourceLanguage } from "@tarjuman/core/languages"
import type { TranslateResult, WordResult } from "@tarjuman/core/schema"
import type { Result } from "@tarjuman/panel"

declare global {
  interface Window {
    bubble: { click(): void; dragStart(): void; drag(dx: number, dy: number): void; dragEnd(): void }
    tarjuman: {
      languages(): Promise<{ from: SourceLanguage; to: LanguageCode }>
      translate(text: string, from: SourceLanguage, to: LanguageCode): Promise<Result<TranslateResult>>
      lookup(word: string, context: string, to: LanguageCode): Promise<Result<WordResult>>
      copy(text: string): Promise<void>
      setLanguages(from: SourceLanguage, to: LanguageCode): void
      hide(): void
      onShow(listener: (text: string) => void): void
      onEmpty(listener: () => void): void
      onLanguages(listener: (langs: { from: SourceLanguage; to: LanguageCode }) => void): void
    }
  }
}
