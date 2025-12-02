-- Migration: add orders and order_items tables
-- Run this script against the `c372_supermarketdb` database to create order tables

CREATE TABLE `c372_supermarketdb`.`orders` (
  `order_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NULL,
  `order_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`order_id`),
  KEY `idx_orders_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `c372_supermarketdb`.`order_items` (
  `item_id` INT NOT NULL AUTO_INCREMENT,
  `order_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `price_at_time_of_purchase` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`item_id`),
  KEY `idx_order_items_order_id` (`order_id`),
  KEY `idx_order_items_product_id` (`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) 
      REFERENCES `c372_supermarketdb`.`orders`(`order_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) 
      REFERENCES `c372_supermarketdb`.`products`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `c372_supermarketdb`.`cart_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `ux_user_product` (`user_id`, `product_id`),
  CONSTRAINT `fk_cart_user` FOREIGN KEY (`user_id`) 
      REFERENCES `c372_supermarketdb`.`users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cart_product` FOREIGN KEY (`product_id`) 
      REFERENCES `c372_supermarketdb`.`products`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional: add foreign key from orders.user_id to users.id if you want enforced ownership
-- ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL;

-- End of migration