import Capacitor

class QibanViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(QibanNativePlugin())
    }
}
