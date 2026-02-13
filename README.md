# PimcoreBulkSearchBundle

A Pimcore bundle that enables bulk search functionality in the admin grid listings. Search for multiple values at once by entering each value on a separate line.

## Features

- **Bulk Search Option**: Adds a "Bulk Search" option to the column header dropdown menu in Pimcore grid listings
- **Multi-Value Search**: Enter multiple values (e.g., SKUs, product codes, IDs) each on a separate line
- **OR Logic Matching**: The grid filters to show records matching ANY of the provided values
- **Supported Grids**: Works with Object Search, Variants Tab, and Asset Folder listings
- **Input Field Support**: Available on text/input type columns

## Requirements

- Pimcore 11.x
- PHP 8.1 or higher

## Installation

### Step 1: Install via Composer

```bash
composer require rohit-raj-verma/pimcore-bulk-search-bundle
```

### Step 2: Enable the Bundle

Add the bundle to your `config/bundles.php`:

```php
return [
    // ...
    PimcoreBulkSearchBundle\PimcoreBulkSearchBundle::class => ['all' => true],
];
```

### Step 3: Clear Cache

```bash
bin/console cache:clear
```

## Usage

1. Navigate to any Data Object listing in Pimcore admin (e.g., Products folder)
2. Click the **down arrow** on any text/input column header to open the column menu
3. Select **"Bulk Search"** from the dropdown options
4. In the popup window, enter the values you want to search for, **one value per line**:
   ```
   SKU001
   SKU002
   SKU003
   PRD-12345
   ```
5. Click **"Apply"** to filter the grid

The grid will now display only records where the selected column matches ANY of the entered values.

### Example Use Cases

- **Search multiple SKUs**: Quickly find products by pasting a list of SKU codes
- **Bulk ID lookup**: Search for multiple object IDs at once
- **Product code validation**: Verify which codes exist in the system from a spreadsheet list
- **Order item lookup**: Find items by multiple reference numbers

## How It Works

The bundle patches Pimcore's grid header context menu to add a "Bulk Search" option for input-type columns. When activated:

1. A modal window opens with a textarea for entering values
2. Each line is parsed as a separate search value
3. Empty lines and duplicates are automatically filtered out
4. A list-type filter is applied to the grid store with OR logic
5. The grid reloads showing matching records

## Debugging

To enable debug logging in the browser console:

```javascript
// Enable debug mode
window.localStorage.setItem('pimcoreBulkSearchDebug', '1');

// Disable debug mode
window.localStorage.removeItem('pimcoreBulkSearchDebug');
```

## Translations

The bundle includes English translations. To add additional languages, create translation files in `translations/admin.{locale}.yml` with the following keys:

```yaml
pimcore_bulk_search_bulk_search_option: 'Bulk Search'
pimcore_bulk_search_values: 'Values'
pimcore_bulk_search_hint_one_value_per_line: 'Enter one value per line. The listing will match any of the provided values.'
```

## License

This bundle is released under the MIT License.
