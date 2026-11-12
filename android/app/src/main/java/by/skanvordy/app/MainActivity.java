package by.skanvordy.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/** Оболочка вокруг веб-приложения «Сканворды». Страница берётся с сайта и кэшируется, поэтому приложение обновляется без переустановки и работает без интернета. */
public class MainActivity extends Activity {
    static final String HOME = "https://ravettikeney-sudo.github.io/skanvordy/";
    private static final String HOST = "ravettikeney-sudo.github.io";
    private WebView web;
    private Ads ads;
    private static final int REQ_NOTIFY = 13;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#EEF3FB"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " SkanvordyApp/1.2");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/skanvordy")) return false;
                open(u);
                return true;
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) showOffline();
            }
        });
        web.addJavascriptInterface(new Bridge(), "SkanApp");
        ads = new Ads(this, code -> runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); }));
        Daily.ensureChannel(this);
        Daily.schedule(this);
        if (BuildConfig.SELF_UPDATE) Updater.check(this);
        String start = getIntent() != null ? getIntent().getStringExtra("url") : null;
        if (start != null && start.startsWith(HOME)) web.loadUrl(start);
        else if (getIntent() != null && getIntent().getData() != null && getIntent().getData().toString().startsWith(HOME)) web.loadUrl(getIntent().getData().toString());
        else if (state != null) web.restoreState(state);
        else web.loadUrl(HOME);
    }

    private void open(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
        catch (Exception e) { toast("Не получилось открыть ссылку"); }
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i); setIntent(i);
        String u = i.getStringExtra("url"); if (u != null && u.startsWith(HOME)) web.loadUrl(u);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code == REQ_NOTIFY && (results.length == 0 || results[0] != PackageManager.PERMISSION_GRANTED))
            toast("Уведомления выключены. Включите их: Настройки → Приложения → Сканворды → Уведомления");
    }

    private class Bridge {
        /** Время напоминания о сканворде дня «ЧЧ:ММ», пустая строка — выключить. */
        @JavascriptInterface public void setDaily(String time) {
            Daily.prefs(MainActivity.this).edit().putString("time", time == null ? "" : time).apply();
            Daily.schedule(MainActivity.this);
            if (time != null && !time.isEmpty() && Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY));
        }
        /** Есть ли загруженное видео за подсказки. */
        @JavascriptInterface public boolean hasAds() { return ads != null && ads.hasRewarded(); }
        /** Показать видео за подсказки; ответ придёт в window.onRewarded(true|false). */
        @JavascriptInterface public void showRewarded() { runOnUiThread(() -> ads.showRewarded()); }
        /** Человек уходит с экрана победы: здесь иногда показываем полноэкранную рекламу. */
        @JavascriptInterface public void showInterstitial() { runOnUiThread(() -> ads.maybeShowInterstitial()); }
        @JavascriptInterface public void shareText(String text) {
            Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            runOnUiThread(() -> { try { startActivity(Intent.createChooser(send, "Отправить результат")); } catch (Exception e) { toast("Не получилось отправить"); } });
        }
        @JavascriptInterface public void openUrl(String url) { runOnUiThread(() -> open(Uri.parse(url))); }
        @JavascriptInterface public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }
    }

    private void toast(String m) { runOnUiThread(() -> Toast.makeText(this, m, Toast.LENGTH_LONG).show()); }

    private void showOffline() {
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
            + "<body style='margin:0;background:#EEF3FB;color:#1D3A7A;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
            + "<div style='padding:24px'><h2>Нужен интернет для первого запуска</h2>"
            + "<p style='color:#4A5F8A;font-size:18px'>Подключитесь к Wi-Fi или мобильному интернету один раз. Дальше сканворды будут работать и без него.</p>"
            + "<button onclick=\"location.href='" + HOME + "'\" style='margin-top:12px;padding:16px 28px;border:0;border-radius:16px;background:#1D3A7A;color:#fff;font-size:19px;font-weight:700'>Повторить</button></div></body></html>";
        web.loadDataWithBaseURL(HOME, html, "text/html", "utf-8", HOME);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){try{return window.appBack?window.appBack():false}catch(e){return false}})()", value -> {
            if ("true".equals(value)) return;
            if (web.canGoBack()) web.goBack(); else finish();
        });
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); if (ads != null) ads.resume(); if (BuildConfig.SELF_UPDATE) Updater.resume(this); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
