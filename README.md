# PPP Compare - Purchasing Power Parity Calculator

This is a Next.js application designed to help users understand and compare the cost of living between different countries using Purchasing Power Parity (PPP) data sourced directly from the World Bank.

## Features

*   **PPP Calculator:** Calculate the equivalent amount needed in one country to match the purchasing power of a specific amount in another country for a given year.
*   **Historical Comparison:** Visualize the trend of purchasing power equivalence between two selected countries over time using an interactive line chart.
*   **Country Selection:** Choose from a list of countries populated directly from the World Bank dataset.
*   **Year Selection:** Select the year for the PPP comparison, with the latest available year defaulted.
*   **Currency Display:** Shows relevant currency symbols (where available) for the selected countries.
*   **PPP Explanation:** Includes an easy-to-understand explanation of what PPP is and how the calculator works.
*   **Responsive Design:** Built with Tailwind CSS and ShadCN UI for a clean and responsive user experience on various devices.

## Technologies Used

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **UI Library:** ShadCN UI
*   **Styling:** Tailwind CSS
*   **Charting:** Recharts
*   **Data Fetching:** Native `fetch` API
*   **Data Source:** World Bank API (Indicator: PA.NUS.PPP)

## Getting Started

### Prerequisites

*   Node.js (Version 18 or later recommended)
*   npm or yarn or pnpm

### Installation & Setup

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
    *(If you are using a development environment like Firebase Studio, cloning might not be necessary)*

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

3.  **Environment Variables:**
    Create a `.env` file in the root of the project. While the core PPP functionality doesn't strictly require API keys for the World Bank data fetch (it's public), if GenAI features were added later (using Genkit as configured in the project), you would need to add your Google Generative AI API key:
    ```env
    GOOGLE_GENAI_API_KEY=YOUR_API_KEY_HERE
    ```
    *(Currently, this key is not essential for the PPP calculator itself)*

4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```

5.  Open [http://localhost:9002](http://localhost:9002) (or the specified port) in your browser to see the application.

## How to Use

1.  Wait for the initial data (country list and latest year) to load from the World Bank.
2.  Select the **"From Country"** - the country where the original amount is based.
3.  Select the **"To Country"** - the country you want to compare against.
4.  Enter the **"Amount"** in the currency of the "From Country".
5.  Select the **"Year"** for the comparison (defaults to the latest available year).
6.  Click **"Calculate PPP"**.
7.  The results will show the equivalent amount in the "To Country" currency needed to have the same purchasing power.
8.  Below the result, a chart will display the historical trend of this equivalent amount over the years where data is available for both countries.
9.  Expand the "What is Purchasing Power Parity (PPP)?" section for a detailed explanation.

## Data Source

The Purchasing Power Parity data is sourced directly from the World Bank's public API, specifically using the indicator `PA.NUS.PPP`. Currency symbols are illustrative and based on a predefined mapping. Data availability may vary by country and year. For official financial decisions, always consult the original World Bank data sources.
