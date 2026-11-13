"""Create an SVG QR locally (no third-party data sharing). Requires python3-qrcode."""
import sys
import qrcode
import qrcode.image.svg

if __name__ == '__main__':
    if len(sys.argv) != 2 or len(sys.argv[1]) > 512:
        sys.exit(2)
    image = qrcode.make(sys.argv[1], image_factory=qrcode.image.svg.SvgPathImage, box_size=5, border=2)
    image.save(sys.stdout.buffer)
