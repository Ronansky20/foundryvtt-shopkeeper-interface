# Persona 5 Royal Shopkeeper Interface

A FoundryVTT module that transforms the Cyberpunk RED vendor interface into a stylized Persona 5 Royal shop experience.

## Features

- **Persona 5 Royal Aesthetic**: Blue and black color scheme with distinctive P5R styling
- **Interactive Shop UI**: Browse items with keyboard navigation (Arrow keys, Enter, Escape)
- **Shopping Cart System**: Add items to cart before purchasing
- **Cyberpunk RED Integration**: Works seamlessly with the Cyberpunk RED system's economy (Eurobucks)
- **Easy Access**: Shop button added to NPC actor sheets
- **Chat Commands**: Open shops via `/shop [vendorName]` command

## Installation

1. In FoundryVTT, go to **Add-on Modules** tab
2. Click **Install Module**
3. Paste the manifest URL: `[Your manifest URL here]`
4. Click **Install**
5. Enable the module in your game world

## Usage

### Opening a Shop

#### Method 1: Actor Sheet Button
1. Open an NPC actor sheet that you want to use as a vendor
2. Click the shopping cart button in the window header
3. Make sure you have a character selected or a token controlled

#### Method 2: Chat Command
Type in chat: `/shop [VendorName]`
- Replace `[VendorName]` with the name of the NPC vendor actor

#### Method 3: Macro/Script
```javascript
const vendor = game.actors.getName("Vendor Name");
const buyer = game.user.character;
game.persona5shop.openShop(vendor, buyer);
```

### Shopping Controls

- **Mouse**: Click items to select, click buttons to interact
- **Arrow Up/Down**: Navigate through items
- **Enter**: Add selected item to cart
- **Escape**: Close shop window

### Setting Up Vendors

1. Create an NPC actor in Cyberpunk RED
2. Add items to the NPC's inventory
3. Make sure items have prices set in their system data
4. Players can then shop from this NPC

## Configuration

The module includes a world setting:
- **Enable Persona 5 Shop UI**: Toggle the shop button on NPC sheets

Access via: **Game Settings → Configure Settings → Module Settings**

## Compatibility

- **FoundryVTT**: v11 - v12
- **System**: Cyberpunk RED Core
- **Dependencies**: None (uses core FoundryVTT APIs)

## Styling

The interface features:
- Vibrant blue gradient backgrounds
- Black panels with red and cyan accents
- Animated scanline effects
- Character silhouette display
- Responsive item lists with hover effects
- Shopping cart with real-time totals

## Development

This module is open source. Feel free to contribute or modify!

### File Structure
```
persona5-shopkeeper/
├── module.json          # Module manifest
├── scripts/
│   └── main.js         # Main module logic
├── styles/
│   └── persona5-shop.css  # P5R styling
├── templates/
│   └── shop.html       # Shop UI template
├── lang/
│   └── en.json         # Localization
├── LICENSE
└── README.md
```

## Credits

- Inspired by Persona 5 Royal's shop interface
- Built for the Cyberpunk RED system by R. Talsorian Games
- Created for the FoundryVTT community

## License

This project is licensed under the terms specified in the LICENSE file.

## Support

For issues, suggestions, or contributions:
- GitHub Issues: [Your GitHub repository]
- Discord: [Your Discord server]

---

**Disclaimer**: This is unofficial content for the Cyberpunk RED system. Persona 5 Royal is property of Atlus. This module is a fan creation and is not affiliated with or endorsed by Atlus or R. Talsorian Games.
