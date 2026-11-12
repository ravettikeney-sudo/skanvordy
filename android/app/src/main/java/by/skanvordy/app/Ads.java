package by.skanvordy.app;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import com.yandex.mobile.ads.common.AdError;
import com.yandex.mobile.ads.common.AdRequest;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.common.YandexAds;
import com.yandex.mobile.ads.interstitial.InterstitialAd;
import com.yandex.mobile.ads.interstitial.InterstitialAdEventListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoadListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoader;
import com.yandex.mobile.ads.rewarded.Reward;
import com.yandex.mobile.ads.rewarded.RewardedAd;
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoader;

/**
 * Реклама Рекламной сети Яндекса.
 * Видео за подсказки (с вознаграждением) и полноэкранная реклама после решённой головоломки.
 * Все вызовы SDK делаются в главном потоке.
 */
final class Ads {
    /** Блоки РСЯ приложения «Сканворды и кроссворды» (ID приложения 20409905). */
    static final String REWARDED_ID = "R-M-20409905-1";      // «Подсказки»
    static final String INTERSTITIAL_ID = "R-M-20409905-2";  // «После победы»

    /** Полноэкранная реклама не чаще, чем раз в 4 минуты, и не сразу после видео за подсказки. */
    private static final long INTERSTITIAL_GAP_MS = 4 * 60 * 1000L;
    /** Первые решённые головоломки — без полноэкранной рекламы, чтобы человек успел освоиться. */
    private static final int FREE_WINS = 2;

    interface Js { void run(String code); }

    private final Activity act;
    private final Js js;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final SharedPreferences prefs;

    private RewardedAdLoader rewardedLoader;
    private RewardedAd rewarded;
    private boolean rewardedLoading;
    private int rewardedFails;

    private InterstitialAdLoader interLoader;
    private InterstitialAd inter;
    private boolean interLoading;
    private int interFails;

    private long lastFullscreen;
    private boolean ready;

    Ads(Activity act, Js js) {
        this.act = act;
        this.js = js;
        this.prefs = act.getSharedPreferences("ads", Activity.MODE_PRIVATE);
        try {
            YandexAds.initialize(act.getApplicationContext(), () -> main.post(() -> {
                ready = true;
                rewardedLoader = new RewardedAdLoader(act);
                interLoader = new InterstitialAdLoader(act);
                loadRewarded();
                loadInterstitial();
            }));
        } catch (Throwable ignored) { }
    }

    /** Догружаем рекламу, если её нет (например, после возврата в приложение). */
    void resume() { if (ready) { loadRewarded(); loadInterstitial(); } }

    // ---------- видео за подсказки ----------

    boolean hasRewarded() { return rewarded != null; }

    private void loadRewarded() {
        if (!ready || rewarded != null || rewardedLoading) return;
        rewardedLoading = true;
        try {
            rewardedLoader.loadAd(new AdRequest.Builder(REWARDED_ID).build(), new RewardedAdLoadListener() {
                @Override public void onAdLoaded(RewardedAd ad) { rewardedLoading = false; rewardedFails = 0; rewarded = ad; }
                @Override public void onAdFailedToLoad(AdRequestError e) {
                    rewardedLoading = false;
                    // Повторяем не сразу, а с нарастающей паузой: 30 с, 1 мин, 2 мин... до 5 минут.
                    long delay = Math.min(300_000L, 30_000L << Math.min(rewardedFails++, 4));
                    main.postDelayed(Ads.this::loadRewarded, delay);
                }
            });
        } catch (Throwable t) { rewardedLoading = false; }
    }

    /** Показывает видео. По итогу вызывает в странице window.onRewarded(true|false). */
    void showRewarded() {
        final RewardedAd ad = rewarded;
        if (ad == null) { answer(false); loadRewarded(); return; }
        rewarded = null;
        final boolean[] got = {false};
        ad.setAdEventListener(new RewardedAdEventListener() {
            @Override public void onAdShown() { }
            @Override public void onAdFailedToShow(AdError e) { ad.setAdEventListener(null); answer(false); loadRewarded(); }
            @Override public void onAdDismissed() { ad.setAdEventListener(null); lastFullscreen = System.currentTimeMillis(); answer(got[0]); loadRewarded(); }
            @Override public void onAdClicked() { }
            @Override public void onAdImpression(ImpressionData d) { }
            @Override public void onRewarded(Reward r) { got[0] = true; }
        });
        try { ad.show(act); } catch (Throwable t) { answer(false); loadRewarded(); }
    }

    private void answer(boolean ok) { js.run("window.onRewarded&&window.onRewarded(" + ok + ")"); }

    // ---------- полноэкранная реклама после победы ----------

    private void loadInterstitial() {
        if (!ready || inter != null || interLoading) return;
        interLoading = true;
        try {
            interLoader.loadAd(new AdRequest.Builder(INTERSTITIAL_ID).build(), new InterstitialAdLoadListener() {
                @Override public void onAdLoaded(InterstitialAd ad) { interLoading = false; interFails = 0; inter = ad; }
                @Override public void onAdFailedToLoad(AdRequestError e) {
                    interLoading = false;
                    long delay = Math.min(300_000L, 30_000L << Math.min(interFails++, 4));
                    main.postDelayed(Ads.this::loadInterstitial, delay);
                }
            });
        } catch (Throwable t) { interLoading = false; }
    }

    /** Вызывается, когда человек уходит с экрана победы. Сама решает, пора ли показывать. */
    boolean maybeShowInterstitial() {
        int wins = prefs.getInt("wins", 0) + 1;
        prefs.edit().putInt("wins", wins).apply();
        long now = System.currentTimeMillis();
        final InterstitialAd ad = inter;
        if (ad == null) { loadInterstitial(); return false; }
        if (wins <= FREE_WINS || now - lastFullscreen < INTERSTITIAL_GAP_MS) return false;
        inter = null;
        lastFullscreen = now;
        ad.setAdEventListener(new InterstitialAdEventListener() {
            @Override public void onAdShown() { }
            @Override public void onAdFailedToShow(AdError e) { ad.setAdEventListener(null); loadInterstitial(); }
            @Override public void onAdDismissed() { ad.setAdEventListener(null); lastFullscreen = System.currentTimeMillis(); loadInterstitial(); }
            @Override public void onAdClicked() { }
            @Override public void onAdImpression(ImpressionData d) { }
        });
        try { ad.show(act); return true; } catch (Throwable t) { loadInterstitial(); return false; }
    }
}
