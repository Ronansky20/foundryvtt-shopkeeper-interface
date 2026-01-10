/**
 * Persona 5 Royal Shopkeeper Interface for Cyberpunk RED
 * Transforms the vendor UI into a stylized P5R shop experience
 */

class Persona5ShopApp extends Application {
  constructor(vendor, buyer, options = {}) {
    super(options);
    this.vendor = vendor;
    this.buyer = buyer;
    this.cart = [];
    this.selectedIndex = 0;
    this.inventory = [];
    this.loadInventory();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "persona5-shop",
      template: "modules/persona5-shopkeeper/templates/shop.html",
      classes: ["persona5-shop"],
      width: window.innerWidth,
      height: window.innerHeight,
      resizable: false,
      title: "",
      popOut: true,
      minimizable: false,
      frame: false,
      top: 0,
      left: 0
    });
  }

  loadInventory() {
    // Load items from the vendor actor
    if (this.vendor?.items) {
      this.inventory = this.vendor.items.map(item => ({
        id: item.id,
        name: item.name,
        img: item.img,
        price: item.system?.price?.market || item.system?.cost || 0,
        quantity: item.system?.amount || 1,
        description: item.system?.description || "",
        type: item.type
      }));
    }
  }

  getData() {
    const data = super.getData();
    
    // Get buyer's currency (eurobucks for Cyberpunk RED)
    const buyerCurrency = this.buyer?.system?.wealth?.euro || 0;
    
    // Calculate cart total
    const cartTotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return {
      vendor: this.vendor?.name || game.i18n.localize("PERSONA5SHOP.Vendor"),
      vendorImg: this.vendor?.img || "icons/svg/mystery-man.svg",
      buyer: this.buyer?.name || game.i18n.localize("PERSONA5SHOP.Buyer"),
      buyerImg: this.buyer?.img || "icons/svg/mystery-man.svg",
      currency: buyerCurrency,
      inventory: this.inventory,
      cart: this.cart,
      cartTotal: cartTotal,
      selectedIndex: this.selectedIndex,
      canAfford: buyerCurrency >= cartTotal
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Debug: Check if buttons exist
    console.log("Buttons found:", html.find('.p5-button').length);
    
    // Item selection
    html.on('click', '.shop-item-row', this._onSelectItem.bind(this));
    
    // Purchase actions - use event delegation
    html.on('click', '.btn-add', this._onAddToCart.bind(this));
    html.on('click', '.btn-buy', this._onPurchase.bind(this));
    html.on('click', '.btn-exit', this._onExit.bind(this));
    
    // Keyboard navigation
    this._setupKeyboardNavigation(html);
  }

  _setupKeyboardNavigation(html) {
    $(document).on('keydown.persona5shop', (event) => {
      if (!this.rendered) return;
      
      switch(event.key) {
        case 'ArrowUp':
          event.preventDefault();
          this._navigateItems(-1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          this._navigateItems(1);
          break;
        case 'Enter':
          event.preventDefault();
          this._onAddToCart();
          break;
        case 'Escape':
          event.preventDefault();
          this.close();
          break;
      }
    });
  }

  _navigateItems(direction) {
    this.selectedIndex = Math.max(0, Math.min(this.inventory.length - 1, this.selectedIndex + direction));
    this.render();
  }

  _onSelectItem(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).data('item-id');
    this.selectedIndex = this.inventory.findIndex(i => i.id === itemId);
    this.render();
  }

  async _onAddToCart(event) {
    if (event) event.preventDefault();
    
    const selectedItem = this.inventory[this.selectedIndex];
    if (!selectedItem) return;
    
    // Check if item already in cart
    const cartItem = this.cart.find(i => i.id === selectedItem.id);
    if (cartItem) {
      cartItem.quantity += 1;
    } else {
      this.cart.push({...selectedItem, quantity: 1});
    }
    
    // Play sound effect
    AudioHelper.play({src: "sounds/notify.wav", volume: 0.8, autoplay: true}, true);
    
    this.render();
  }

  async _onRemoveFromCart(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).data('item-id');
    this.cart = this.cart.filter(i => i.id !== itemId);
    this.render();
  }

  async _onPurchase(event) {
    event.preventDefault();
    
    if (this.cart.length === 0) {
      ui.notifications.warn(game.i18n.localize("PERSONA5SHOP.EmptyCart"));
      return;
    }
    
    const cartTotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const buyerCurrency = this.buyer?.system?.wealth?.euro || 0;
    
    if (buyerCurrency < cartTotal) {
      ui.notifications.error(game.i18n.localize("PERSONA5SHOP.InsufficientFunds"));
      return;
    }
    
    // Deduct currency from buyer
    await this.buyer.update({
      "system.wealth.euro": buyerCurrency - cartTotal
    });
    
    // Add items to buyer's inventory
    for (const cartItem of this.cart) {
      const originalItem = this.vendor.items.get(cartItem.id);
      if (originalItem) {
        const itemData = originalItem.toObject();
        if (itemData.system?.amount) {
          itemData.system.amount = cartItem.quantity;
        }
        await this.buyer.createEmbeddedDocuments("Item", [itemData]);
      }
    }
    
    // Play success sound
    AudioHelper.play({src: "sounds/notify.wav", volume: 1.0, autoplay: true}, true);
    
    ui.notifications.info(game.i18n.localize("PERSONA5SHOP.PurchaseComplete"));
    
    // Clear cart
    this.cart = [];
    this.render();
  }

  _onExit(event) {
    event.preventDefault();
    this.close();
  }

  async _renderInner(data) {
    const html = await super._renderInner(data);
    
    // Remove all borders from parent elements
    this.element.css({
      'border': 'none',
      'box-shadow': 'none',
      'background': 'transparent'
    });
    
    return html;
  }

  async _renderOuter(force) {
    const html = await super._renderOuter(force);
    
    // Hide the actual window element
    html.hide();
    
    // Extract just the content
    const content = html.find('.window-content').html();
    
    // Create a wrapper div and insert it into the body
    if ($('#persona5-shop-wrapper').length === 0) {
      $('body').append(`<div id="persona5-shop-wrapper"></div>`);
    }
    
    $('#persona5-shop-wrapper').html(content);
    
    // Activate listeners on the new element AFTER inserting HTML
    this.activateListeners($('#persona5-shop-wrapper'));
    
    return html;
  }

  close(options) {
    $(document).off('keydown.persona5shop');
    $('#persona5-shop-wrapper').remove();
    return super.close(options);
  }
}

// Hook into FoundryVTT initialization
Hooks.once('init', () => {
  console.log("Persona 5 Shopkeeper Interface | Initializing");
  
  // Register module settings
  game.settings.register("persona5-shopkeeper", "enableCustomUI", {
    name: game.i18n.localize("PERSONA5SHOP.SettingEnableUI"),
    hint: game.i18n.localize("PERSONA5SHOP.SettingEnableUIHint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once('ready', () => {
  console.log("Persona 5 Shopkeeper Interface | Ready");
  
  // Register global function to open shop
  game.persona5shop = {
    openShop: function(vendor, buyer) {
      if (!vendor || !buyer) {
        ui.notifications.error("Vendor and buyer must be specified");
        return;
      }
      new Persona5ShopApp(vendor, buyer).render(true);
    }
  };
  
  // Add macro button support
  Hooks.on("renderActorSheet", (app, html, data) => {
    if (!game.settings.get("persona5-shopkeeper", "enableCustomUI")) return;
    
    // Add "Open Shop" button to actor sheets
    const actor = app.actor;
    const isVendorType = ["container"].includes(actor?.type);
    if (!isVendorType) return;

    const header = app.element.find('.window-header');
    if (!header.length || header.find('.persona5-shop-button').length) return;

    const shopButton = $(`<a class="persona5-shop-button" title="${game.i18n.localize('PERSONA5SHOP.OpenShop')}">
      <i class="fas fa-shopping-cart"></i> ${game.i18n.localize('PERSONA5SHOP.Shop')}
    </a>`);
    
    shopButton.click(() => {
      const controlledToken = canvas?.tokens?.controlled?.[0];
      const buyer = controlledToken?.actor || game.user.character;
      
      if (!buyer) {
        ui.notifications.warn(game.i18n.localize("PERSONA5SHOP.SelectBuyer"));
        return;
      }
      
      game.persona5shop.openShop(actor, buyer);
    });
    
    // Place the button next to the other header controls
    const closeButton = header.find('.close');
    if (closeButton.length) {
      closeButton.before(shopButton);
    } else {
      header.append(shopButton);
    }
  });
});

// Chat command to open shop
Hooks.on("chatMessage", (chatLog, message, chatData) => {
  if (message.startsWith("/shop")) {
    const args = message.split(" ");
    
    // Usage: /shop [vendorName]
    if (args.length < 2) {
      ui.notifications.info("Usage: /shop [vendorName]");
      return false;
    }
    
    const vendorName = args.slice(1).join(" ");
    const vendor = game.actors.getName(vendorName);
    const buyer = game.user.character || canvas.tokens.controlled[0]?.actor;
    
    if (!vendor) {
      ui.notifications.error(`Vendor "${vendorName}" not found`);
      return false;
    }
    
    if (!buyer) {
      ui.notifications.error("No character selected");
      return false;
    }
    
    game.persona5shop.openShop(vendor, buyer);
    return false;
  }
});

export { Persona5ShopApp };
