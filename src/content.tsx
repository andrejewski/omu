export type Locale = 'en-US' | 'ja-JP'

export type Content = {
  title: string
  description: string
  startGameButton: string
  aboutGameButton: string
  returnToHomeButton: string
  anotherOneButton: string
  downloadButton: string
  selectLanguageButton: string
  aboutPageContent: JSX.Element
}

export function getContent(locale: Locale): Content {
  switch (locale) {
    case 'en-US':
      return {
        title: 'Maid Cafe Omurice Simulator',
        description: 'Pen your next masterpiece in ketchup',
        startGameButton: 'Start drawing',
        aboutGameButton: "What's this?",
        returnToHomeButton: 'Return to home',
        anotherOneButton: 'Another one',
        downloadButton: 'Download',
        selectLanguageButton: 'Select a language',
        aboutPageContent: (
          <>
            <h1>What's this about?</h1>
            <p>
              Japanese maid cafes have a staple dish <i>omurice</i>. The maids
              will often draw cute pictures on omurice using ketchup.
            </p>
            <p>
              Omurice drawing is a fun medium of creative expression. This
              simulator captures some of that magic.
            </p>
            <p>
              Draw a person, place, thing, or message in ketchup and share it
              with those dear to you.
            </p>

            <p>
              Made by <a href="https://jew.ski">Chris Andrejewski</a>
            </p>
          </>
        ),
      }
    case 'ja-JP':
      return {
        title: 'メイドカフェオムライスシミュレーター',
        description: 'ケチャップで次の傑作を書き留める',
        startGameButton: '描き始める',
        aboutGameButton: 'ゲームについて',
        returnToHomeButton: 'トップに戻る',
        anotherOneButton: 'もう一つ作る',
        downloadButton: 'ダウンロードする',
        selectLanguageButton: '言語を選択',
        aboutPageContent: (
          <>
            <h1>これって何ですか？</h1>
            <p>
              日本のメイドカフェには、代表的な料理としてオムライスがありますね。
              メイドたちはよく、ケチャップを使ってオムライスにかわいい絵を描いてくれます。
            </p>
            <p>
              オムライスの絵描きは、創造的な表現の楽しい方法です。このシミュレーターでその楽しさを体験してみませんか？
            </p>
            <p>
              人、場所、物、またはメッセージをケチャップで描いて、大切な人とシェアしましょう。
            </p>
            <p>
              <a href="https://jew.ski">クリス・アンドレジェスキ</a>
              によって製作されました。
            </p>
          </>
        ),
      }
  }
}
