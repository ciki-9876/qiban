"""Resize the existing Qixi icon into native asset formats; no generated artwork."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
source = root.parent.parent / "outputs/qiban-growth-prototype/icons/icon-512.png"
image = Image.open(source).convert("RGB")
image.resize((1024, 1024), Image.Resampling.LANCZOS).save(root / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
res = root / "android/app/src/main/res"
background = image.getpixel((0, 0))
for density, scale in [("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4)]:
    folder = res / f"mipmap-{density}"
    for name in ["ic_launcher.png", "ic_launcher_round.png"]:
        image.resize((int(48 * scale), int(48 * scale)), Image.Resampling.LANCZOS).save(folder / name)
    size, content = int(108 * scale), int(72 * scale)
    foreground = Image.new("RGBA", (size, size), (*background, 255))
    foreground.paste(image.resize((content, content), Image.Resampling.LANCZOS), ((size - content) // 2, (size - content) // 2))
    foreground.save(folder / "ic_launcher_foreground.png")
for splash in [*res.glob("drawable*/splash.png"), *root.glob("ios/App/App/Assets.xcassets/Splash.imageset/*.png")]:
    size = Image.open(splash).size
    canvas = Image.new("RGB", size, background)
    width = max(48, min(int(min(size) * .3), 512))
    logo = image.resize((width, width), Image.Resampling.LANCZOS)
    canvas.paste(logo, ((size[0] - width) // 2, (size[1] - width) // 2))
    canvas.save(splash, optimize=True)
print("Native icons and launch screens use the existing Qixi artwork.")
