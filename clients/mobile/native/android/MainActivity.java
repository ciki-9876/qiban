package io.github.ciki9876.qiban.dev;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QibanNativePlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                PluginHandle handle = getBridge().getPlugin("QibanNative");
                if (handle != null) ((QibanNativePlugin) handle.getInstance()).emitBack();
            }
        });
    }
}
