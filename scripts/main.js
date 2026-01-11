/**
 * Persona 5 Royal Shopkeeper Interface for Cyberpunk RED
 * Transforms the vendor UI into a stylized P5R shop experience
 */

class Persona5ShopApp extends Application {
  constructor(vendor, buyer, options = {}) {
    super(options);
    this.vendor = vendor;
    
    // Auto-detect proper buyer if not provided or if vendor was passed as buyer
    this.buyer = this._detectBuyer(buyer, vendor);
    
    console.log('Shop initialized - Vendor:', this.vendor?.name, 'Buyer:', this.buyer?.name);
    
    this.cart = [];
    this.selectedIndex = 0;
    this.inventory = [];
    this.loadInventory();
  }

  _detectBuyer(buyer, vendor) {
    // If buyer is the same as vendor, it's wrong - need to find the player's character
    if (buyer?.id === vendor?.id) {
      console.warn('Buyer same as vendor, auto-detecting player character');
      buyer = null;
    }
    
    // Validate buyer is a character type with proper ownership
    if (buyer) {
      const hasOwnership = buyer.ownership?.[game.user.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER || buyer.ownership?.default === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
      if (buyer.type === 'character' && hasOwnership) {
        console.log('Using provided buyer:', buyer.name, 'Type:', buyer.type);
        return buyer;
      }
      console.warn('Provided buyer invalid (not character or not owned), searching for valid character');
      buyer = null;
    }
    
    // If no valid buyer provided, try to find player's owned character
    if (!buyer) {
      // Try controlled token first - must be character type with OWNER permission
      const controlledToken = canvas?.tokens?.controlled?.[0];
      if (controlledToken?.actor) {
        const actor = controlledToken.actor;
        const hasOwnership = actor.ownership?.[game.user.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER || actor.ownership?.default === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        if (actor.type === 'character' && hasOwnership) {
          console.log('Using controlled token character:', actor.name, 'Ownership:', hasOwnership);
          return actor;
        }
      }
      
      // Try assigned character
      if (game.user.character?.type === 'character') {
        const hasOwnership = game.user.character.ownership?.[game.user.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        if (hasOwnership) {
          console.log('Using assigned character:', game.user.character.name);
          return game.user.character;
        }
      }
      
      // Search for any character-type actor where current user has OWNER permission
      const ownedCharacter = game.actors.find(a => {
        const hasOwnership = a.ownership?.[game.user.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        const isCharacter = a.type === 'character';
        const notVendor = a.id !== vendor?.id;
        return isCharacter && hasOwnership && notVendor;
      });
      
      if (ownedCharacter) {
        console.log('Using owned character:', ownedCharacter.name, 'Type:', ownedCharacter.type);
        return ownedCharacter;
      }
      
      console.error('Could not find valid buyer character with OWNER permission');
      ui.notifications.error('No character found with OWNER permission. Please ensure you own a character actor.');
      return null;
    }
    
    return buyer;
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
    
    // Get buyer's currency with robust detection
    const buyerCurrency = this._getBuyerCurrency();
    
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

  _getBuyerCurrency() {
    if (!this.buyer) {
      console.warn('No buyer actor set');
      return 0;
    }

    console.log('Buyer actor:', this.buyer.name);
    console.log('Buyer system data:', this.buyer.system);

    // Try multiple common currency paths across different systems
    const currencyPaths = [
      // Cyberpunk RED (primary)
      () => this.buyer.system?.wealth?.value,
      // Cyberpunk RED
      () => this.buyer.system?.wealth?.euro,
      () => this.buyer.system?.wealth?.eurobucks,
      // D&D 5e and similar
      () => this.buyer.system?.currency?.gp,
      () => this.buyer.system?.attributes?.currency?.gp,
      // Generic currency field
      () => this.buyer.system?.currency,
      () => this.buyer.system?.money,
      () => this.buyer.system?.wealth,
    ];

    for (const pathFn of currencyPaths) {
      try {
        const value = pathFn();
        if (value !== undefined && value !== null) {
          console.log('Found currency:', value, 'via path');
          return Number(value) || 0;
        }
      } catch (e) {
        // Path doesn't exist, continue
      }
    }

    console.error('Could not find currency in buyer actor. Available system keys:', Object.keys(this.buyer.system || {}));
    return 0;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Update date from Simple Calendar if available
    this._updateDateDisplay(html);
    
    // Debug: Check if buttons exist
    console.log("Buttons found:", html.find('.p5-button').length);
    
    // Item selection - delay to allow dblclick to fire
    let clickTimer = null;
    html.on('click', '.shop-item-row', (event) => {
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        this._onSelectItem(event);
      }, 200);
    });
    
    // Double-click to add to cart
    html.on('dblclick', '.shop-item-row', (event) => {
      clearTimeout(clickTimer);
      this._onAddToCart(event);
    });
    
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
    
    // If event targets a specific row, use that item id
    let selectedIdx = this.selectedIndex;
    if (event?.currentTarget) {
      const itemId = $(event.currentTarget).data('item-id');
      if (itemId) {
        const idx = this.inventory.findIndex(i => i.id === itemId);
        if (idx >= 0) selectedIdx = idx;
      }
    }
    
    const selectedItem = this.inventory[selectedIdx];
    if (!selectedItem) {
      console.warn('No item selected to add to cart');
      return;
    }
    
    console.log('Adding to cart:', selectedItem.name, 'ID:', selectedItem.id);
    
    // Check if item already in cart
    const cartItem = this.cart.find(i => i.id === selectedItem.id);
    if (cartItem) {
      cartItem.quantity += 1;
      console.log('Incremented quantity:', cartItem.quantity);
    } else {
      this.cart.push({...selectedItem, quantity: 1});
      console.log('Added new item to cart');
    }
    
    console.log('Cart now has', this.cart.length, 'unique items');
    
    // Play sound effect
    AudioHelper.play({src: "sounds/notify.wav", volume: 0.8, autoplay: true}, true);
    
    this.selectedIndex = selectedIdx;
    await this.render();
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
    const buyerCurrency = this._getBuyerCurrency();
    
    console.log('Purchase attempt - Cart total:', cartTotal, 'Buyer currency:', buyerCurrency);
    
    if (buyerCurrency < cartTotal) {
      ui.notifications.error(game.i18n.localize("PERSONA5SHOP.InsufficientFunds"));
      return;
    }
    
    // Deduct currency from buyer - try the path we found
    const newAmount = buyerCurrency - cartTotal;
    
    // Try to update via the same paths we check
    try {
      if (this.buyer.system?.wealth?.value !== undefined) {
        await this.buyer.update({"system.wealth.value": newAmount});
      } else if (this.buyer.system?.wealth?.euro !== undefined) {
        await this.buyer.update({"system.wealth.euro": newAmount});
      } else if (this.buyer.system?.wealth?.eurobucks !== undefined) {
        await this.buyer.update({"system.wealth.eurobucks": newAmount});
      } else if (this.buyer.system?.currency?.gp !== undefined) {
        await this.buyer.update({"system.currency.gp": newAmount});
      } else if (this.buyer.system?.currency !== undefined) {
        await this.buyer.update({"system.currency": newAmount});
      } else if (this.buyer.system?.money !== undefined) {
        await this.buyer.update({"system.money": newAmount});
      } else if (this.buyer.system?.wealth !== undefined) {
        await this.buyer.update({"system.wealth": newAmount});
      } else {
        console.error('Could not determine currency update path');
        ui.notifications.error('Unable to deduct currency from actor');
        return;
      }
    } catch (e) {
      console.error('Error updating buyer currency:', e);
      ui.notifications.error('Failed to update currency');
      return;
    }
    
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

  /**
   * Update date display using Simple Calendar if available
   */
  _updateDateDisplay(html) {
    const dateElement = html.find('#currentDate');
    
    if (!dateElement.length) {
      console.warn("Date element not found");
      return;
    }
    
    let dateText = "April 11th";
    
    try {
      // Try both possible module IDs
      const scModule = game.modules.get('foundryvtt-simple-calendar') || game.modules.get('simple-calendar');
      console.log("Simple Calendar module found:", !!scModule, "active:", scModule?.active);
      
      if (scModule?.active && window.SimpleCalendar) {
        const SC = window.SimpleCalendar;
        console.log("SimpleCalendar API available:", !!SC.api);
        
        // Try the timestamp display method
        try {
          if (SC.api?.timestampToDate) {
            const currentTimestamp = SC.api.timestamp();
            const dateObj = SC.api.timestampToDate(currentTimestamp);
            console.log("Date object:", dateObj);
            
            if (dateObj && dateObj.month !== undefined && dateObj.day !== undefined) {
              const calendar = SC.api.getCurrentCalendar?.() || {};
              const monthName = calendar.months?.[dateObj.month]?.name || `Month ${dateObj.month + 1}`;
              dateText = `${monthName} ${dateObj.day + 1}`;
              console.log("Successfully got date:", dateText);
            }
          }
        } catch (e) {
          console.warn("Error with timestamp API:", e);
        }
        
        // Fallback: Try formatted date display
        if (dateText === "April 11th" && SC.api?.formatDateTime) {
          try {
            const formatted = SC.api.formatDateTime({});
            if (formatted) {
              dateText = formatted;
              console.log("Got formatted date:", dateText);
            }
          } catch (e) {
            console.warn("Error with formatDateTime:", e);
          }
        }
      } else {
        console.log("Simple Calendar not available - using fallback date");
      }
    } catch (e) {
      console.error("Error in _updateDateDisplay:", e);
    }
    
    console.log("Setting date to:", dateText);
    dateElement.text(dateText);
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
    // Render normally in Foundry window to ensure visibility
    return await super._renderOuter(force);
  }

  close(options) {
    $(document).off('keydown.persona5shop');
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
    
    // Only show button on container-type actors (vendors)
    const actor = app.actor;
    if (actor?.type !== 'container') return;

    // Find the window header via the app element to avoid DOM traversal issues
    const appEl = app.element || html.closest('.app');
    const header = appEl?.find('.window-header');
    if (!header?.length) {
      console.warn('Persona5Shop: window header not found for actor', actor?.name);
      return;
    }
    if (header.find('.persona5-shop-button').length) return;

    const shopButton = $(`<a class="persona5-shop-button" title="${game.i18n.localize('PERSONA5SHOP.OpenShop')}">
      <i class="fas fa-shopping-cart"></i> ${game.i18n.localize('PERSONA5SHOP.Shop')}
    </a>`);
    
    shopButton.click(() => {
      console.log('Persona5Shop: Shop button clicked for vendor', actor?.name);
      // Prefer reading the buyer directly from the rendered sheet DOM
      const dropdown = appEl.find('select.trade-with-dropdown, select[name="trade-with-dropdown"]');
      const buyerId = dropdown.val();
      
      let buyer = null;
      if (buyerId) {
        buyer = game.actors.get(buyerId);
        if (!buyer) {
          ui.notifications.error(`Trade target "${buyerId}" not found`);
          return;
        }
      } else {
        // Fallback: try known system paths if DOM not found
        const fallbackId = actor.system?.tradeWithDropdown || actor.system?.trade_with_dropdown || actor.system?.tradeWith || actor.system?.trade_with;
        if (fallbackId) {
          buyer = game.actors.get(fallbackId);
        }
        if (!buyer) {
          ui.notifications.error('Please select a character in the vendor\'s "Trade with" dropdown.');
          return;
        }
      }
      
      console.log('Opening shop - Vendor:', actor.name, 'Buyer:', buyer?.name);
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
    
    if (!vendor) {
      ui.notifications.error(`Vendor "${vendorName}" not found`);
      return false;
    }
    
    // Verify vendor is a container
    if (vendor.type !== 'container') {
      ui.notifications.error(`"${vendorName}" must be a container actor`);
      return false;
    }
    
    // Get buyer from vendor's "trade with" field
    const buyerId = vendor.system?.tradeWith || vendor.system?.trade_with;
    let buyer = null;
    
    if (buyerId) {
      buyer = game.actors.get(buyerId);
      if (!buyer) {
        ui.notifications.error(`Trade target actor "${buyerId}" not found`);
        return false;
      }
    } else {
      ui.notifications.error(`Container must have a "trade with" character selected`);
      return false;
    }
    
    game.persona5shop.openShop(vendor, buyer);
    return false;
  }
});

export { Persona5ShopApp };
