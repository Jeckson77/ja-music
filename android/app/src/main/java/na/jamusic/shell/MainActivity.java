package na.jamusic.shell;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;

/** Native Android shell for the unmodified Ja Music demonstration apps. */
public final class MainActivity extends Activity {
    private static final int PICK_FILE_REQUEST = 301;
    private static final String APP_ASSETS_HOST = "appassets.androidplatform.net";
    private WebView browser;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(247, 249, 253));
        getWindow().setNavigationBarColor(Color.rgb(247, 249, 253));
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(APP_ASSETS_HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(247, 249, 253));
        browser.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings config = browser.getSettings();
        config.setJavaScriptEnabled(true);
        config.setDomStorageEnabled(true);
        config.setAllowFileAccess(false);
        config.setAllowContentAccess(false);
        config.setMediaPlaybackRequiresUserGesture(true);
        config.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        browser.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equalsIgnoreCase(url.getScheme())
                        && APP_ASSETS_HOST.equalsIgnoreCase(url.getHost())) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException ignored) {
                    // The app remains usable even when no external handler is installed.
                }
                return true;
            }
        });

        browser.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                              FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK_FILE_REQUEST);
                    return true;
                } catch (ActivityNotFoundException ex) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }
        });
        setContentView(browser);
        if (savedInstanceState != null) {
            browser.restoreState(savedInstanceState);
        } else {
            browser.loadUrl("https://" + APP_ASSETS_HOST + "/assets/" + BuildConfig.START_PAGE);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (browser != null) browser.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (browser != null && browser.canGoBack()) browser.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (browser != null) {
            browser.destroy();
            browser = null;
        }
        super.onDestroy();
    }
}
