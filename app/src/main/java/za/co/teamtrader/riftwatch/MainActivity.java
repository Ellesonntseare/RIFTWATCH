package za.co.teamtrader.riftwatch;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.net.Uri;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final String GAME_URL = "https://rift.teamtrader.co.za/";
    private static final int AUDIO_PERMISSION_REQUEST = 1;
    private WebView gameView;
    private PermissionRequest pendingAudioRequest;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );

        gameView = new WebView(this);
        gameView.getSettings().setJavaScriptEnabled(true);
        gameView.getSettings().setDomStorageEnabled(true);
        gameView.getSettings().setUseWideViewPort(true);
        gameView.getSettings().setLoadWithOverviewMode(true);
        gameView.getSettings().setTextZoom(100);
        gameView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        gameView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();
                if (!"https".equals(uri.getScheme()) ||
                    !"rift.teamtrader.co.za".equals(uri.getHost()) ||
                    path == null || !path.startsWith("/models/")) return null;
                String name = uri.getLastPathSegment();
                if (name == null || !name.endsWith(".glb") || name.contains("/") || name.contains("..")) return null;
                try {
                    InputStream asset = getAssets().open("models/" + name);
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Content-Length", String.valueOf(asset.available()));
                    headers.put("X-Asset-Size", String.valueOf(asset.available()));
                    headers.put("Cache-Control", "public, max-age=86400");
                    return new WebResourceResponse("model/gltf-binary", null, 200, "OK", headers, asset);
                } catch (IOException missingAsset) {
                    return null;
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Game server unavailable")
                    .setMessage("Connect to the internet and make sure the RIFTWATCH server and Cloudflare tunnel are running.")
                    .setPositiveButton("Retry", (dialog, which) -> gameView.loadUrl(GAME_URL))
                    .setNegativeButton("Close", (dialog, which) -> finish())
                    .show();
            }
        });
        gameView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> handleWebPermission(request));
            }
        });
        setContentView(gameView);
        if (state == null || gameView.restoreState(state) == null) {
            gameView.loadUrl(GAME_URL);
        }
    }

    private void handleWebPermission(PermissionRequest request) {
        String host = request.getOrigin().getHost();
        if (!"rift.teamtrader.co.za".equals(host) ||
            !"https".equals(request.getOrigin().getScheme())) {
            request.deny();
            return;
        }
        boolean wantsAudio = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) wantsAudio = true;
            else {
                request.deny();
                return;
            }
        }
        if (!wantsAudio) {
            request.deny();
        } else if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
        } else {
            pendingAudioRequest = request;
            requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, AUDIO_PERMISSION_REQUEST);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == AUDIO_PERMISSION_REQUEST && pendingAudioRequest != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
                pendingAudioRequest.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
            } else {
                pendingAudioRequest.deny();
            }
            pendingAudioRequest = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (gameView.canGoBack()) gameView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        gameView.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onDestroy() {
        if (pendingAudioRequest != null) pendingAudioRequest.deny();
        gameView.destroy();
        super.onDestroy();
    }
}
