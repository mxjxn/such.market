# the plan for Cryptoart.social

in this document, I will describe this app in detail, page by page.

## MVP - minimum viable Product

This is the most basic featureset we must build and ship ASAP.

## Main landing page

Lets list the features found on this site, top to bottom

- The header, "Cryptoart auctionhouse"
- a button that says "create auction" to the right of the header text
- Below the header, a single column of auctions. 
  ... Each auction card contains:
  - a full-width artwork, maximum height 500px, cropping the bottom if its taller than wide.
  - current bid, or reserve price and the $ticker its denominated in
  - @handle of current bidder, if any
  - time remaining, or "place a bid to start this auction"
  - "minimum bid" button
  - clicking the image opens the auction page

## Auction page

This is the design for an individual auction page.

- Artwork, full width.
- about-section
  - Title
  - Artist name
  - @owner-handle
- bid-section
  - reserve price OR current bid
  - price text-input (numbers only, decimals allowed) (automatically filled with the minimum next-highest bid)

