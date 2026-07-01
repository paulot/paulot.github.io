let pyodideInstance = null;
let executionCount = 0;

// Embedded notebook JSON for fallback (e.g. when running locally via file:// protocol under CORS restrictions)
const embeddedNotebook = {
  "cells": [
    {
      "cell_type": "markdown",
      "source": [
        "# Predicting the 2026 World Cup: A Bayesian MCMC Poisson Model\n",
        "\n",
        "This interactive notebook models national team strength for the 32 teams advancing to the 2026 FIFA World Cup knockout stage.\n",
        "\n",
        "### Mathematical Framework and Coefficient Derivation\n",
        "To establish a highly reliable predictive model, goal-scoring and goal-concession rates are evaluated through a time-decayed lens. A team's true tactical strength is modeled as an amalgamation of their **historical baseline** (30% weight from the 2023\u20132026 qualification cycle) and their **immediate tournament form** (70% weight from the 2026 World Cup group stage).\n",
        "\n",
        "Because football is inherently a low-scoring sport governed by a Poisson distribution, linear comparisons of goal differences often distort team capabilities. To rectify this, raw expected attack and defense rates are transformed using a natural logarithm, creating a standardized, zero-centered distribution:\n",
        "- **Raw Attack Score**: Weighted average of goals scored per game.\n",
        "- **Raw Defense Vulnerability**: Weighted average of goals conceded per game.\n",
        "- **Attack Coefficient ($a_i$)**: Derived by taking $\\log(\\text{Raw Attack Score})$ and subtracting the tournament mean.\n",
        "- **Defense Coefficient ($d_i$)**: Derived by taking $-\\log(\\text{Raw Defense Vulnerability})$ and adjusting to the tournament mean. A higher positive defense coefficient represents a stronger, more impenetrable defensive structure.\n",
        "\n",
        "The Poisson rate $\\lambda_{ij}$ for team $i$ playing against team $j$ is modeled as:\n",
        "$$\\log(\\lambda_{ij}) = \\mu + a_i - d_j$$\n",
        "where $\\mu$ is the baseline log-goal rate."
      ],
      "metadata": {
        "id": "d19e8760"
      }
    },
    {
      "cell_type": "code",
      "source": [
        "import math\n",
        "import random\n",
        "\n",
        "# Set seed for reproducible results\n",
        "random.seed(42)\n",
        "\n",
        "# BEGIN_KNOWN_KNOCKOUT_RESULTS\n",
        "known_knockout_results = {\n",
        "    ('Brazil', 'Japan'): {'goals': {'Brazil': 2, 'Japan': 1}, 'winner': 'Brazil', 'is_penalty': False},\n",
        "    ('Canada', 'South Africa'): {'goals': {'South Africa': 0, 'Canada': 1}, 'winner': 'Canada', 'is_penalty': False},\n",
        "    ('France', 'Sweden'): {'goals': {'France': 3, 'Sweden': 0}, 'winner': 'France', 'is_penalty': False},\n",
        "    ('Germany', 'Paraguay'): {'goals': {'Germany': 1, 'Paraguay': 1}, 'winner': 'Paraguay', 'is_penalty': True},\n",
        "    ('Ivory Coast', 'Norway'): {'goals': {'Ivory Coast': 1, 'Norway': 2}, 'winner': 'Norway', 'is_penalty': False},\n",
        "    ('Morocco', 'Netherlands'): {'goals': {'Netherlands': 1, 'Morocco': 1}, 'winner': 'Morocco', 'is_penalty': True},\n",
        "}\n",
        "# END_KNOWN_KNOCKOUT_RESULTS\n",
        "\n",
        "team_list = [\n",
        "    \"South Africa\", \"Canada\", \"Germany\", \"Paraguay\",\n",
        "    \"Netherlands\", \"Morocco\", \"Brazil\", \"Japan\",\n",
        "    \"France\", \"Sweden\", \"Ivory Coast\", \"Norway\",\n",
        "    \"Mexico\", \"Ecuador\", \"England\", \"DR Congo\",\n",
        "    \"USA\", \"Bosnia and Herzegovina\", \"Belgium\", \"Senegal\",\n",
        "    \"Portugal\", \"Croatia\", \"Spain\", \"Austria\",\n",
        "    \"Switzerland\", \"Algeria\", \"Argentina\", \"Cape Verde\",\n",
        "    \"Colombia\", \"Ghana\", \"Australia\", \"Egypt\"\n",
        "]\n",
        "\n",
        "# Priors based on the Advanced Quantitative Modeling Report (June 2026)\n",
        "team_priors = {\n",
        "    \"Spain\": {\"elo\": 2144, \"raw_attack\": 2.2167, \"raw_defense\": 0.1000, \"attack_coef\": 0.1869, \"defense_coef\": 2.0720},\n",
        "    \"Argentina\": {\"elo\": 2144, \"raw_attack\": 2.3833, \"raw_defense\": 0.4000, \"attack_coef\": 0.2594, \"defense_coef\": 0.6857},\n",
        "    \"France\": {\"elo\": 2123, \"raw_attack\": 3.1333, \"raw_defense\": 0.6667, \"attack_coef\": 0.5330, \"defense_coef\": 0.1749},\n",
        "    \"England\": {\"elo\": 2038, \"raw_attack\": 2.2250, \"raw_defense\": 0.4667, \"attack_coef\": 0.1907, \"defense_coef\": 0.5315},\n",
        "    \"Brazil\": {\"elo\": 2009, \"raw_attack\": 2.0333, \"raw_defense\": 0.5167, \"attack_coef\": 0.1006, \"defense_coef\": 0.4298},\n",
        "    \"Colombia\": {\"elo\": 2004, \"raw_attack\": 1.4000, \"raw_defense\": 0.5333, \"attack_coef\": -0.2726, \"defense_coef\": 0.3980},\n",
        "    \"Portugal\": {\"elo\": 1990, \"raw_attack\": 2.4000, \"raw_defense\": 0.5833, \"attack_coef\": 0.2664, \"defense_coef\": 0.3084},\n",
        "    \"Netherlands\": {\"elo\": 1980, \"raw_attack\": 3.3458, \"raw_defense\": 1.0833, \"attack_coef\": 0.5986, \"defense_coef\": -0.3106},\n",
        "    \"Norway\": {\"elo\": 1918, \"raw_attack\": 3.2542, \"raw_defense\": 1.8208, \"attack_coef\": 0.5709, \"defense_coef\": -0.8299},\n",
        "    \"Germany\": {\"elo\": 1916, \"raw_attack\": 3.1333, \"raw_defense\": 1.0833, \"attack_coef\": 0.5330, \"defense_coef\": -0.3106},\n",
        "    \"Switzerland\": {\"elo\": 1914, \"raw_attack\": 2.3333, \"raw_defense\": 0.8000, \"attack_coef\": 0.2382, \"defense_coef\": -0.0074},\n",
        "    \"Mexico\": {\"elo\": 1912, \"raw_attack\": 1.7600, \"raw_defense\": 0.2400, \"attack_coef\": -0.0438, \"defense_coef\": 1.1965},\n",
        "    \"Japan\": {\"elo\": 1910, \"raw_attack\": 2.5333, \"raw_defense\": 0.7900, \"attack_coef\": 0.3205, \"defense_coef\": 0.0051},\n",
        "    \"Croatia\": {\"elo\": 1905, \"raw_attack\": 2.1417, \"raw_defense\": 1.3167, \"attack_coef\": 0.1525, \"defense_coef\": -0.5057},\n",
        "    \"Ecuador\": {\"elo\": 1902, \"raw_attack\": 0.7000, \"raw_defense\": 0.5500, \"attack_coef\": -0.9658, \"defense_coef\": 0.3672},\n",
        "    \"Belgium\": {\"elo\": 1884, \"raw_attack\": 2.4875, \"raw_defense\": 0.7292, \"attack_coef\": 0.3022, \"defense_coef\": 0.0853},\n",
        "    \"Morocco\": {\"elo\": 1877, \"raw_attack\": 2.2250, \"raw_defense\": 0.7750, \"attack_coef\": 0.1907, \"defense_coef\": 0.0243},\n",
        "    \"Senegal\": {\"elo\": 1842, \"raw_attack\": 2.5267, \"raw_defense\": 1.4900, \"attack_coef\": 0.3178, \"defense_coef\": -0.6294},\n",
        "    \"Austria\": {\"elo\": 1841, \"raw_attack\": 2.2250, \"raw_defense\": 1.5500, \"attack_coef\": 0.1907, \"defense_coef\": -0.6688},\n",
        "    \"Paraguay\": {\"elo\": 1815, \"raw_attack\": 0.7000, \"raw_defense\": 1.1000, \"attack_coef\": -0.9658, \"defense_coef\": -0.3259},\n",
        "    \"Australia\": {\"elo\": 1800, \"raw_attack\": 0.9467, \"raw_defense\": 0.6767, \"attack_coef\": -0.6639, \"defense_coef\": 0.1600},\n",
        "    \"USA\": {\"elo\": 1781, \"raw_attack\": 2.3167, \"raw_defense\": 1.2633, \"attack_coef\": 0.2310, \"defense_coef\": -0.4643},\n",
        "    \"Algeria\": {\"elo\": 1780, \"raw_attack\": 1.8867, \"raw_defense\": 1.8733, \"attack_coef\": 0.0257, \"defense_coef\": -0.8583},\n",
        "    \"Canada\": {\"elo\": 1748, \"raw_attack\": 2.1167, \"raw_defense\": 1.0000, \"attack_coef\": 0.1408, \"defense_coef\": -0.2306},\n",
        "    \"Ivory Coast\": {\"elo\": 1743, \"raw_attack\": 1.6833, \"raw_defense\": 0.4667, \"attack_coef\": -0.0883, \"defense_coef\": 0.5315},\n",
        "    \"Sweden\": {\"elo\": 1742, \"raw_attack\": 1.9333, \"raw_defense\": 2.1208, \"attack_coef\": 0.0502, \"defense_coef\": -0.9824},\n",
        "    \"Egypt\": {\"elo\": 1742, \"raw_attack\": 1.7667, \"raw_defense\": 0.7600, \"attack_coef\": -0.0400, \"defense_coef\": 0.0438},\n",
        "    \"DR Congo\": {\"elo\": 1712, \"raw_attack\": 1.3833, \"raw_defense\": 0.8800, \"attack_coef\": -0.2846, \"defense_coef\": -0.1028},\n",
        "    \"Bosnia and Herzegovina\": {\"elo\": 1622, \"raw_attack\": 1.8042, \"raw_defense\": 1.6625, \"attack_coef\": -0.0190, \"defense_coef\": -0.7389},\n",
        "    \"Cape Verde\": {\"elo\": 1622, \"raw_attack\": 0.9467, \"raw_defense\": 0.7067, \"attack_coef\": -0.6639, \"defense_coef\": 0.1166},\n",
        "    \"Ghana\": {\"elo\": 1575, \"raw_attack\": 0.9167, \"raw_defense\": 0.7667, \"attack_coef\": -0.6961, \"defense_coef\": 0.0351},\n",
        "    \"South Africa\": {\"elo\": 1575, \"raw_attack\": 0.9167, \"raw_defense\": 0.9700, \"attack_coef\": -0.6961, \"defense_coef\": -0.2001}\n",
        "}"
      ],
      "metadata": {
        "id": "19e640bd"
      },
      "execution_count": 1,
      "outputs": []
    },
    {
      "cell_type": "markdown",
      "source": [
        "### Pedigree vs. Performance: The Elo Disconnect\n",
        "A notable disconnect exists between established historical momentum (represented by the World Football Elo Ratings) and immediate tournament volatility. While Elo ratings provide a stable, slow-moving metric of historical pedigree, they fail to capture immediate tactical efficacy.\n",
        "\n",
        "For example, Spain and Argentina share the apex with Elo ratings of **2144**, but teams like the **Netherlands** (Elo 1980) and **Norway** (Elo 1918) drastically over-index in immediate offensive output, generating staggering Raw Attack Scores of **3.35** and **3.25** respectively.\n",
        "\n",
        "### Tactical Footprint: The Four Quadrants\n",
        "Mapping the Attack Coefficient (horizontal axis) against the Defense Coefficient (vertical axis) reveals four distinct tactical quadrants:\n",
        "1. **Elite, Balanced (Top-Right)**: Teams like **France** (att: 0.53, def: 0.17), **Japan**, **Portugal**, and **England** that transition seamlessly between offensive domination and defensive recovery.\n",
        "2. **Glass Cannons (Bottom-Right)**: Teams like the **Netherlands** (att: 0.60, def: -0.31) and **Germany** (att: 0.53, def: -0.31) that compensate for defensive fragility with overwhelming goal-scoring volume.\n",
        "3. **Defensive Juggernauts (Top-Left)**: Teams like **Spain** (def: 2.07) and **Mexico** (def: 1.20) that prioritize absolute structural rigidity and clean sheets.\n",
        "4. **Attrition Specialists (Bottom-Left)**: Teams like **Ecuador**, **Paraguay**, **South Africa**, and **Ghana** that under-index in both but survive by dragging superior opponents into low-event, physical, and chaotic matches."
      ],
      "metadata": {
        "id": "a85c2bc9"
      }
    },
    {
      "cell_type": "code",
      "source": [
        "# Baseline log-goals (overall tournament mean)\n",
        "mu = math.log(1.35)\n",
        "\n",
        "def log_prior(params):\n",
        "    log_p = 0.0\n",
        "    sigma_coef = 0.15  # Prior SD for coefficients\n",
        "    sigma_elo = 0.25   # Prior SD for Elo alignment\n",
        "    for team, values in params.items():\n",
        "        # 1. Coefficient Priors (from the report)\n",
        "        prior_att = team_priors[team][\"attack_coef\"]\n",
        "        prior_def = team_priors[team][\"defense_coef\"]\n",
        "        log_p += -((values[\"attack\"] - prior_att) ** 2) / (2 * sigma_coef ** 2)\n",
        "        log_p += -((values[\"defense\"] - prior_def) ** 2) / (2 * sigma_coef ** 2)\n",
        "        \n",
        "        # 2. Elo Prior: Net strength (attack + defense) aligned with Elo rating\n",
        "        elo = team_priors[team][\"elo\"]\n",
        "        expected_net_strength = (elo - 1850) / 200.0\n",
        "        actual_net_strength = values[\"attack\"] + values[\"defense\"]\n",
        "        log_p += -((actual_net_strength - expected_net_strength) ** 2) / (2 * sigma_elo ** 2)\n",
        "    return log_p\n",
        "\n",
        "# Real Group Stage Results to train the MCMC model\n",
        "observed_matches = [\n",
        "    (\"Mexico\", \"South Africa\", 2, 0),\n",
        "    (\"Canada\", \"Bosnia and Herzegovina\", 1, 1),\n",
        "    (\"Switzerland\", \"Bosnia and Herzegovina\", 4, 1),\n",
        "    (\"Switzerland\", \"Canada\", 2, 1),\n",
        "    (\"Brazil\", \"Morocco\", 1, 1),\n",
        "    (\"USA\", \"Paraguay\", 4, 1),\n",
        "    (\"USA\", \"Australia\", 2, 0),\n",
        "    (\"Paraguay\", \"Australia\", 0, 0),\n",
        "    (\"Ivory Coast\", \"Ecuador\", 1, 0),\n",
        "    (\"Germany\", \"Ivory Coast\", 2, 1),\n",
        "    (\"Ecuador\", \"Germany\", 2, 1),\n",
        "    (\"Netherlands\", \"Japan\", 2, 2),\n",
        "    (\"Netherlands\", \"Sweden\", 5, 1),\n",
        "    (\"Japan\", \"Sweden\", 1, 1),\n",
        "    (\"Belgium\", \"Egypt\", 1, 1),\n",
        "    (\"Spain\", \"Cape Verde\", 0, 0),\n",
        "    (\"France\", \"Senegal\", 3, 1),\n",
        "    (\"Norway\", \"Senegal\", 3, 2),\n",
        "    (\"Norway\", \"France\", 1, 4),\n",
        "    (\"Argentina\", \"Algeria\", 3, 0),\n",
        "    (\"Argentina\", \"Austria\", 2, 0),\n",
        "    (\"Algeria\", \"Austria\", 3, 3),\n",
        "    (\"Portugal\", \"DR Congo\", 1, 1),\n",
        "    (\"Colombia\", \"DR Congo\", 1, 0),\n",
        "    (\"Colombia\", \"Portugal\", 0, 0),\n",
        "    (\"England\", \"Croatia\", 4, 2),\n",
        "    (\"England\", \"Ghana\", 0, 0),\n",
        "    (\"Croatia\", \"Ghana\", 2, 1)\n",
        "]\n",
        "\n",
        "# Add known knockout results to observed_matches for MCMC training\n",
        "for key, res in known_knockout_results.items():\n",
        "    t1, t2 = key\n",
        "    g1 = res[\"goals\"][t1]\n",
        "    g2 = res[\"goals\"][t2]\n",
        "    observed_matches.append((t1, t2, g1, g2))\n",
        "\n",
        "def log_likelihood(params):\n",
        "    log_l = 0.0\n",
        "    for team_a, team_b, goals_a, goals_b in observed_matches:\n",
        "        att_a = params[team_a][\"attack\"]\n",
        "        def_a = params[team_a][\"defense\"]\n",
        "        att_b = params[team_b][\"attack\"]\n",
        "        def_b = params[team_b][\"defense\"]\n",
        "        \n",
        "        lambda_a = math.exp(mu + att_a - def_b)\n",
        "        lambda_b = math.exp(mu + att_b - def_a)\n",
        "        \n",
        "        log_l += goals_a * math.log(lambda_a) - lambda_a\n",
        "        log_l += goals_b * math.log(lambda_b) - lambda_b\n",
        "    return log_l\n",
        "\n",
        "def log_posterior(params):\n",
        "    return log_prior(params) + log_likelihood(params)\n"
      ],
      "metadata": {
        "id": "577c172d"
      },
      "execution_count": 2,
      "outputs": []
    },
    {
      "cell_type": "markdown",
      "source": [
        "## Metropolis-Hastings MCMC Sampler and Match Simulation Formula\n",
        "\n",
        "We define the posterior distribution and sample from it using a custom Metropolis-Hastings MCMC sampler. The chain is run for **5,000** iterations, and initialized at the prior coefficients.\n",
        "\n",
        "### Match Simulation Model and Weight Partitioning\n",
        "To simulate a match between Team A ($i$) and Team B ($j$), we calculate the Poisson goal-scoring rates $\\lambda_{ij}$ (expected goals for Team A) and $\\lambda_{ji}$ (expected goals for Team B).\n",
        "\n",
        "The log-rate $\\log(\\lambda_{ij})$ is modeled by partitioning team capabilities into **53% Strength** (35% Elo rating, 18% MCMC posterior tournament coefficients) and **47% Luck** (zero-mean match-day random variance):\n",
        "\n",
        "$$\\log(\\lambda_{ij}) = \\mu + 0.35 \\cdot E_{ij} + 0.18 \\cdot M_{ij} + 0.47 \\cdot L_i$$\n",
        "\n",
        "Where:\n",
        "- $\\mu$ is the baseline log-goal rate of the tournament (fixed at $\\log(1.35)$).\n",
        "- **Elo Difference ($E_{ij}$)**: The historical pedigree factor, scaled such that 400 Elo points equals 1 unit on the log scale:\n",
        "  $$E_{ij} = \\frac{\\text{Elo}_i - \\text{Elo}_j}{400}$$\n",
        "- **MCMC Coefficient Difference ($M_{ij}$)**: The tournament-specific strength factor, comparing Team A's MCMC posterior attack parameter ($a_i^{\\text{mcmc}}$) against Team B's MCMC posterior defense parameter ($d_j^{\\text{mcmc}}$):\n",
        "  $$M_{ij} = a_i^{\\text{mcmc}} - d_j^{\\text{mcmc}}$$\n",
        "- **Match-Day Luck ($L_i$)**: The highly volatile, match-specific luck/form factor, drawn from a zero-mean normal distribution:\n",
        "  $$L_i \\sim \\mathcal{N}(0, 0.8)$$\n"
      ],
      "metadata": {
        "id": "e4d72f99"
      }
    },
    {
      "cell_type": "code",
      "source": [
        "# Metropolis-Hastings MCMC Sampler\n",
        "def run_mcmc(iterations=5000):\n",
        "    # Initialize parameters at their prior means\n",
        "    current_params = {\n",
        "        team: {\n",
        "            \"attack\": team_priors[team][\"attack_coef\"], \n",
        "            \"defense\": team_priors[team][\"defense_coef\"]\n",
        "        } \n",
        "        for team in team_list\n",
        "    }\n",
        "    current_log_post = log_posterior(current_params)\n",
        "    \n",
        "    chains = {team: {\"attack\": [], \"defense\": []} for team in team_list}\n",
        "    proposal_std = 0.04\n",
        "    accepted = 0\n",
        "    \n",
        "    for i in range(iterations):\n",
        "        proposed_params = {\n",
        "            team: {\n",
        "                \"attack\": current_params[team][\"attack\"], \n",
        "                \"defense\": current_params[team][\"defense\"]\n",
        "            } \n",
        "            for team in team_list\n",
        "        }\n",
        "        team_to_update = random.choice(team_list)\n",
        "        \n",
        "        proposed_params[team_to_update][\"attack\"] += random.normalvariate(0, proposal_std)\n",
        "        proposed_params[team_to_update][\"defense\"] += random.normalvariate(0, proposal_std)\n",
        "        \n",
        "        proposed_log_post = log_posterior(proposed_params)\n",
        "        \n",
        "        log_alpha = proposed_log_post - current_log_post\n",
        "        if math.log(random.random()) < log_alpha:\n",
        "            current_params = proposed_params\n",
        "            current_log_post = proposed_log_post\n",
        "            accepted += 1\n",
        "            \n",
        "        for team in team_list:\n",
        "            chains[team][\"attack\"].append(current_params[team][\"attack\"])\n",
        "            chains[team][\"defense\"].append(current_params[team][\"defense\"])\n",
        "            \n",
        "    print(f\"MCMC Chain complete. Acceptance rate: {accepted / iterations:.2%}\")\n",
        "    return chains\n",
        "\n",
        "# Run MCMC\n",
        "chains = run_mcmc(5000)\n",
        "burn_in = 1000\n",
        "posterior_indices = list(range(burn_in, 5000))\n",
        "random.shuffle(posterior_indices)\n",
        "\n",
        "def poisson_sample(lmbda):\n",
        "    L = math.exp(-lmbda)\n",
        "    k = 0\n",
        "    p = 1.0\n",
        "    while p > L:\n",
        "        k += 1\n",
        "        p *= random.random()\n",
        "    return k - 1\n",
        "\n",
        "def simulate_match_mcmc(team_a, team_b, chain_index):\n",
        "    # Check if there is a known result\n",
        "    key = tuple(sorted([team_a, team_b]))\n",
        "    if key in known_knockout_results:\n",
        "        res = known_knockout_results[key]\n",
        "        goals_a = res[\"goals\"][team_a]\n",
        "        goals_b = res[\"goals\"][team_b]\n",
        "        winner = res[\"winner\"]\n",
        "        if res.get(\"is_penalty\"):\n",
        "            if winner == team_a:\n",
        "                return goals_a, goals_b, f\"{team_a} wins on Penalties\"\n",
        "            else:\n",
        "                return goals_a, goals_b, f\"{team_b} wins on Penalties\"\n",
        "        else:\n",
        "            return goals_a, goals_b, f\"{winner} wins in Normal/Extra Time\"\n",
        "    \n",
        "    # 1. Elo difference (non-random, weight 35%)\n",
        "    elo_a = team_priors[team_a][\"elo\"]\n",
        "    elo_b = team_priors[team_b][\"elo\"]\n",
        "    elo_diff = (elo_a - elo_b) / 400.0\n",
        "    \n",
        "    # 2. MCMC sampled parameters (representing updated strength, weight 18%)\n",
        "    def_mult = 1.0\n",
        "    att_a = chains[team_a][\"attack\"][chain_index]\n",
        "    def_b = chains[team_b][\"defense\"][chain_index]\n",
        "    mcmc_diff_a = att_a - def_mult * def_b\n",
        "    \n",
        "    att_b = chains[team_b][\"attack\"][chain_index]\n",
        "    def_a = chains[team_a][\"defense\"][chain_index]\n",
        "    mcmc_diff_b = att_b - def_mult * def_a\n",
        "    \n",
        "    # 3. True zero-mean match-day luck component (weight 47%)\n",
        "    luck_a = random.normalvariate(0, 0.8)\n",
        "    luck_b = random.normalvariate(0, 0.8)\n",
        "    \n",
        "    # Combine them: 53% Strength (35% Elo, 18% MCMC Coefficients) + 47% Luck\n",
        "    lambda_a = math.exp(mu + 0.35 * elo_diff + 0.18 * mcmc_diff_a + 0.47 * luck_a)\n",
        "    lambda_b = math.exp(mu - 0.35 * elo_diff + 0.18 * mcmc_diff_b + 0.47 * luck_b)\n",
        "    \n",
        "    goals_a = poisson_sample(lambda_a)\n",
        "    goals_b = poisson_sample(lambda_b)\n",
        "    \n",
        "    if goals_a == goals_b:\n",
        "        extra_lambda_a = lambda_a * 0.3\n",
        "        extra_lambda_b = lambda_b * 0.3\n",
        "        goals_a += poisson_sample(extra_lambda_a)\n",
        "        goals_b += poisson_sample(extra_lambda_b)\n",
        "        \n",
        "        if goals_a == goals_b:\n",
        "            prob_a = 0.5 + (0.35 * elo_diff + 0.18 * mcmc_diff_a + 0.47 * luck_a) * 0.1\n",
        "            prob_a = max(0.3, min(0.7, prob_a))\n",
        "            if random.random() < prob_a:\n",
        "                return goals_a, goals_b, f\"{team_a} wins on Penalties\"\n",
        "            else:\n",
        "                return goals_a, goals_b, f\"{team_b} wins on Penalties\"\n",
        "            \n",
        "    winner = team_a if goals_a > goals_b else team_b\n",
        "    return goals_a, goals_b, f\"{winner} wins in Normal/Extra Time\"\n",
        "\n",
        "r32_matchups = [\n",
        "    (\"South Africa\", \"Canada\"),\n",
        "    (\"Germany\", \"Paraguay\"),\n",
        "    (\"Netherlands\", \"Morocco\"),\n",
        "    (\"Brazil\", \"Japan\"),\n",
        "    (\"France\", \"Sweden\"),\n",
        "    (\"Ivory Coast\", \"Norway\"),\n",
        "    (\"Mexico\", \"Ecuador\"),\n",
        "    (\"England\", \"DR Congo\"),\n",
        "    (\"USA\", \"Bosnia and Herzegovina\"),\n",
        "    (\"Belgium\", \"Senegal\"),\n",
        "    (\"Portugal\", \"Croatia\"),\n",
        "    (\"Spain\", \"Austria\"),\n",
        "    (\"Switzerland\", \"Algeria\"),\n",
        "    (\"Argentina\", \"Cape Verde\"),\n",
        "    (\"Colombia\", \"Ghana\"),\n",
        "    (\"Australia\", \"Egypt\")\n",
        "]\n",
        "\n",
        "print(\"--- ROUND OF 32 SIMULATION ---\")\n",
        "r16_teams = []\n",
        "for i, (t1, t2) in enumerate(r32_matchups):\n",
        "    idx = posterior_indices[i]\n",
        "    g1, g2, outcome = simulate_match_mcmc(t1, t2, idx)\n",
        "    winner = t1 if \"wins\" not in outcome or t1 in outcome else t2\n",
        "    r16_teams.append(winner)\n",
        "    print(f\"Match {i+1:02d}: {t1:22} {g1} - {g2} {t2:22} | {outcome}\")\n"
      ],
      "metadata": {
        "id": "2c893100"
      },
      "execution_count": 3,
      "outputs": [
        {
          "name": "stdout",
          "output_type": "stream",
          "text": [
            "MCMC Chain complete. Acceptance rate: 85.30%\n",
            "--- ROUND OF 32 SIMULATION ---\n",
            "Match 01: South Africa           0 - 1 Canada                 | Canada wins in Normal/Extra Time\n",
            "Match 02: Germany                1 - 1 Paraguay               | Paraguay wins on Penalties\n",
            "Match 03: Netherlands            1 - 1 Morocco                | Morocco wins on Penalties\n",
            "Match 04: Brazil                 2 - 1 Japan                  | Brazil wins in Normal/Extra Time\n",
            "Match 05: France                 3 - 0 Sweden                 | France wins in Normal/Extra Time\n",
            "Match 06: Ivory Coast            1 - 2 Norway                 | Norway wins in Normal/Extra Time\n",
            "Match 07: Mexico                 1 - 0 Ecuador                | Mexico wins in Normal/Extra Time\n",
            "Match 08: England                3 - 1 DR Congo               | England wins in Normal/Extra Time\n",
            "Match 09: USA                    2 - 1 Bosnia and Herzegovina | USA wins in Normal/Extra Time\n",
            "Match 10: Belgium                2 - 1 Senegal                | Belgium wins in Normal/Extra Time\n",
            "Match 11: Portugal               1 - 0 Croatia                | Portugal wins in Normal/Extra Time\n",
            "Match 12: Spain                  0 - 2 Austria                | Austria wins in Normal/Extra Time\n",
            "Match 13: Switzerland            1 - 2 Algeria                | Algeria wins in Normal/Extra Time\n",
            "Match 14: Argentina              0 - 0 Cape Verde             | Cape Verde wins on Penalties\n",
            "Match 15: Colombia               2 - 1 Ghana                  | Colombia wins in Normal/Extra Time\n",
            "Match 16: Australia              0 - 2 Egypt                  | Egypt wins in Normal/Extra Time\n"
          ]
        }
      ]
    },
    {
      "cell_type": "markdown",
      "source": [
        "## 2. Simulating the Knockout Stage (R16 to Final)\n",
        "\n",
        "We now simulate the rest of the tournament: Round of 16, Quarter-finals, Semi-finals, and the Final using the MCMC posterior parameters."
      ],
      "metadata": {
        "id": "b419e1c8"
      }
    },
    {
      "cell_type": "code",
      "source": [
        "print(\"--- ROUND OF 16 SIMULATION ---\")\n",
        "w73, w74, w75, w76, w77, w78, w79, w80, w81, w82, w83, w84, w85, w86, w87, w88 = r16_teams\n",
        "\n",
        "r16_matches = [\n",
        "    (\"Match 89\", w73, w75, 16),\n",
        "    (\"Match 90\", w74, w77, 17),\n",
        "    (\"Match 91\", w76, w78, 18),\n",
        "    (\"Match 92\", w79, w80, 19),\n",
        "    (\"Match 93\", w83, w84, 20),\n",
        "    (\"Match 94\", w81, w82, 21),\n",
        "    (\"Match 95\", w86, w88, 22),\n",
        "    (\"Match 96\", w85, w87, 23)\n",
        "]\n",
        "\n",
        "r16_winners = {}\n",
        "for name, t1, t2, post_idx in r16_matches:\n",
        "    idx = posterior_indices[post_idx]\n",
        "    g1, g2, outcome = simulate_match_mcmc(t1, t2, idx)\n",
        "    winner = t1 if \"wins\" not in outcome or t1 in outcome else t2\n",
        "    r16_winners[name] = winner\n",
        "    print(f\"{name}: {t1:22} {g1} - {g2} {t2:22} | {outcome}\")\n",
        "\n",
        "print(\"\\n--- QUARTER-FINALS SIMULATION ---\")\n",
        "w89 = r16_winners[\"Match 89\"]\n",
        "w90 = r16_winners[\"Match 90\"]\n",
        "w91 = r16_winners[\"Match 91\"]\n",
        "w92 = r16_winners[\"Match 92\"]\n",
        "w93 = r16_winners[\"Match 93\"]\n",
        "w94 = r16_winners[\"Match 94\"]\n",
        "w95 = r16_winners[\"Match 95\"]\n",
        "w96 = r16_winners[\"Match 96\"]\n",
        "\n",
        "qf_matches = [\n",
        "    (\"Match 97\", w89, w90, 24),\n",
        "    (\"Match 98\", w93, w94, 25),\n",
        "    (\"Match 99\", w91, w92, 26),\n",
        "    (\"Match 100\", w95, w96, 27)\n",
        "]\n",
        "\n",
        "qf_winners = {}\n",
        "for name, t1, t2, post_idx in qf_matches:\n",
        "    idx = posterior_indices[post_idx]\n",
        "    g1, g2, outcome = simulate_match_mcmc(t1, t2, idx)\n",
        "    winner = t1 if \"wins\" not in outcome or t1 in outcome else t2\n",
        "    qf_winners[name] = winner\n",
        "    print(f\"{name}: {t1:22} {g1} - {g2} {t2:22} | {outcome}\")\n",
        "\n",
        "print(\"\\n--- SEMI-FINALS SIMULATION ---\")\n",
        "w97 = qf_winners[\"Match 97\"]\n",
        "w98 = qf_winners[\"Match 98\"]\n",
        "w99 = qf_winners[\"Match 99\"]\n",
        "w100 = qf_winners[\"Match 100\"]\n",
        "\n",
        "sf_matches = [\n",
        "    (\"Match 101\", w97, w98, 28),\n",
        "    (\"Match 102\", w99, w100, 29)\n",
        "]\n",
        "\n",
        "sf_winners = {}\n",
        "sf_losers = {}\n",
        "for name, t1, t2, post_idx in sf_matches:\n",
        "    idx = posterior_indices[post_idx]\n",
        "    g1, g2, outcome = simulate_match_mcmc(t1, t2, idx)\n",
        "    winner = t1 if \"wins\" not in outcome or t1 in outcome else t2\n",
        "    loser = t2 if winner == t1 else t1\n",
        "    sf_winners[name] = winner\n",
        "    sf_losers[name] = loser\n",
        "    print(f\"{name}: {t1:22} {g1} - {g2} {t2:22} | {outcome}\")\n",
        "\n",
        "print(\"\\n--- THIRD-PLACE PLAYOFF ---\")\n",
        "l101 = sf_losers[\"Match 101\"]\n",
        "l102 = sf_losers[\"Match 102\"]\n",
        "idx = posterior_indices[30]\n",
        "g1, g2, outcome = simulate_match_mcmc(l101, l102, idx)\n",
        "print(f\"Match 103: {l101:22} {g1} - {g2} {l102:22} | {outcome}\")\n",
        "\n",
        "print(\"\\n--- WORLD CUP FINAL ---\")\n",
        "w101 = sf_winners[\"Match 101\"]\n",
        "w102 = sf_winners[\"Match 102\"]\n",
        "idx = posterior_indices[31]\n",
        "g1, g2, outcome = simulate_match_mcmc(w101, w102, idx)\n",
        "print(f\"Match 104: {w101:22} {g1} - {g2} {w102:22} | {outcome}\")\n"
      ],
      "metadata": {
        "id": "9c9f5ceb"
      },
      "execution_count": 4,
      "outputs": [
        {
          "name": "stdout",
          "output_type": "stream",
          "text": [
            "--- ROUND OF 16 SIMULATION ---\n",
            "Match 89: Canada                 1 - 2 Morocco                | Morocco wins in Normal/Extra Time\n",
            "Match 90: Paraguay               1 - 0 France                 | Paraguay wins in Normal/Extra Time\n",
            "Match 91: Brazil                 0 - 2 Norway                 | Norway wins in Normal/Extra Time\n",
            "Match 92: Mexico                 1 - 5 England                | England wins in Normal/Extra Time\n",
            "Match 93: Portugal               1 - 1 Austria                | Portugal wins on Penalties\n",
            "Match 94: USA                    4 - 0 Belgium                | USA wins in Normal/Extra Time\n",
            "Match 95: Cape Verde             0 - 1 Egypt                  | Egypt wins in Normal/Extra Time\n",
            "Match 96: Algeria                3 - 1 Colombia               | Algeria wins in Normal/Extra Time\n",
            "\n",
            "--- QUARTER-FINALS SIMULATION ---\n",
            "Match 97: Morocco                0 - 2 Paraguay               | Paraguay wins in Normal/Extra Time\n",
            "Match 98: Portugal               0 - 1 USA                    | USA wins in Normal/Extra Time\n",
            "Match 99: Norway                 2 - 4 England                | England wins in Normal/Extra Time\n",
            "Match 100: Egypt                  1 - 0 Algeria                | Egypt wins in Normal/Extra Time\n",
            "\n",
            "--- SEMI-FINALS SIMULATION ---\n",
            "Match 101: Paraguay               1 - 0 USA                    | Paraguay wins in Normal/Extra Time\n",
            "Match 102: England                3 - 2 Egypt                  | England wins in Normal/Extra Time\n",
            "\n",
            "--- THIRD-PLACE PLAYOFF ---\n",
            "Match 103: USA                    1 - 1 Egypt                  | USA wins on Penalties\n",
            "\n",
            "--- WORLD CUP FINAL ---\n",
            "Match 104: Paraguay               0 - 1 England                | England wins in Normal/Extra Time\n"
          ]
        }
      ]
    },
    {
      "cell_type": "markdown",
      "source": [
        "## 3. Monte Carlo Tournament Simulation (100,000 Iterations)\n",
        "\n",
        "To compile robust statistical probabilities of tournament success, we run the entire knockout stage (from the Round of 32 to the Final) **100,000** times. For each match in the tournament, we simulate it using MCMC posterior draws. We track the percentage of times each team reaches the Round of 16, Quarter-finals, Semi-finals, Final, and wins the Championship."
      ],
      "metadata": {
        "id": "7936ca09"
      }
    },
    {
      "cell_type": "code",
      "source": [
        "print(\"--- RUNNING MONTE CARLO SIMULATION (100,000 ITERATIONS) ---\")\n",
        "\n",
        "# Initialize stage counts\n",
        "stage_counts = {\n",
        "    team: {\"R16\": 0, \"QF\": 0, \"SF\": 0, \"Final\": 0, \"Champion\": 0}\n",
        "    for team in team_list\n",
        "}\n",
        "\n",
        "num_simulations = 100000\n",
        "\n",
        "for sim in range(num_simulations):\n",
        "    # 1. Round of 32\n",
        "    r16_winners = []\n",
        "    for i, (t1, t2) in enumerate(r32_matchups):\n",
        "        idx = random.choice(posterior_indices)\n",
        "        g1, g2, outcome = simulate_match_mcmc(t1, t2, idx)\n",
        "        winner = t1 if \"wins\" not in outcome or t1 in outcome else t2\n",
        "        r16_winners.append(winner)\n",
        "        stage_counts[winner][\"R16\"] += 1\n",
        "        \n",
        "    # 2. Round of 16\n",
        "    w73, w74, w75, w76, w77, w78, w79, w80, w81, w82, w83, w84, w85, w86, w87, w88 = r16_winners\n",
        "    r16_matches = [\n",
        "        (w73, w75), (w74, w77), (w76, w78), (w79, w80),\n",
        "        (w83, w84), (w81, w82), (w86, w88), (w85, w87)\n",
        "    ]\n",
        "    qf_winners = []\n",
        "    for t1, t2 in r16_matches:\n",
        "        idx = random.choice(posterior_indices)\n",
        "        g1, g2, outcome = simulate_match_mcmc(t1, t2, idx)\n",
        "        winner = t1 if \"wins\" not in outcome or t1 in outcome else t2\n",
        "        qf_winners.append(winner)\n",
        "        stage_counts[winner][\"QF\"] += 1\n",
        "        \n",
        "    # 3. Quarter-finals\n",
        "    w89, w90, w91, w92, w93, w94, w95, w96 = qf_winners\n",
        "    qf_matches = [\n",
        "        (w89, w90), (w93, w94), (w91, w92), (w95, w96)\n",
        "    ]\n",
        "    sf_winners = []\n",
        "    for t1, t2 in qf_matches:\n",
        "        idx = random.choice(posterior_indices)\n",
        "        g1, g2, outcome = simulate_match_mcmc(t1, t2, idx)\n",
        "        winner = t1 if \"wins\" not in outcome or t1 in outcome else t2\n",
        "        sf_winners.append(winner)\n",
        "        stage_counts[winner][\"SF\"] += 1\n",
        "        \n",
        "    # 4. Semi-finals\n",
        "    w97, w98, w99, w100 = sf_winners\n",
        "    sf_matches = [\n",
        "        (w97, w98), (w99, w100)\n",
        "    ]\n",
        "    finalists = []\n",
        "    for t1, t2 in sf_matches:\n",
        "        idx = random.choice(posterior_indices)\n",
        "        g1, g2, outcome = simulate_match_mcmc(t1, t2, idx)\n",
        "        winner = t1 if \"wins\" not in outcome or t1 in outcome else t2\n",
        "        finalists.append(winner)\n",
        "        stage_counts[winner][\"Final\"] += 1\n",
        "        \n",
        "    # 5. Final\n",
        "    w101, w102 = finalists\n",
        "    idx = random.choice(posterior_indices)\n",
        "    g1, g2, outcome = simulate_match_mcmc(w101, w102, idx)\n",
        "    champion = w101 if \"wins\" not in outcome or w101 in outcome else w102\n",
        "    stage_counts[champion][\"Champion\"] += 1\n",
        "\n",
        "# Print results in a beautiful table\n",
        "print(f\"{'Team':25} | {'R16 %':7} | {'QF %':7} | {'SF %':7} | {'Final %':7} | {'Champion %':10}\")\n",
        "print(\"-\" * 75)\n",
        "# Sort teams by Champion percentage\n",
        "sorted_teams = sorted(team_list, key=lambda t: stage_counts[t][\"Champion\"], reverse=True)\n",
        "for team in sorted_teams:\n",
        "    r16_pct = stage_counts[team][\"R16\"] / num_simulations * 100\n",
        "    qf_pct = stage_counts[team][\"QF\"] / num_simulations * 100\n",
        "    sf_pct = stage_counts[team][\"SF\"] / num_simulations * 100\n",
        "    fin_pct = stage_counts[team][\"Final\"] / num_simulations * 100\n",
        "    champ_pct = stage_counts[team][\"Champion\"] / num_simulations * 100\n",
        "    print(f\"{team:25} | {r16_pct:5.1f}% | {qf_pct:5.1f}% | {sf_pct:5.1f}% | {fin_pct:5.1f}% | {champ_pct:8.1f}%\")\n"
      ],
      "metadata": {
        "id": "2bdee2c2"
      },
      "execution_count": 5,
      "outputs": [
        {
          "name": "stdout",
          "output_type": "stream",
          "text": [
            "--- RUNNING MONTE CARLO SIMULATION (100,000 ITERATIONS) ---\n",
            "Team                      | R16 %   | QF %    | SF %    | Final % | Champion %\n",
            "---------------------------------------------------------------------------\n",
            "France                    | 100.0% |  75.1% |  53.1% |  30.5% |     17.6%\n",
            "Spain                     |  76.7% |  52.7% |  40.5% |  26.8% |     17.1%\n",
            "Argentina                 |  83.6% |  63.3% |  42.6% |  27.2% |     16.0%\n",
            "Brazil                    | 100.0% |  57.8% |  30.3% |  15.2% |      7.3%\n",
            "England                   |  74.0% |  44.8% |  25.7% |  13.8% |      7.1%\n",
            "Colombia                  |  77.5% |  47.1% |  23.2% |  12.1% |      5.7%\n",
            "Morocco                   | 100.0% |  58.6% |  22.9% |   9.5% |      3.8%\n",
            "Portugal                  |  58.5% |  24.1% |  15.2% |   7.8% |      3.8%\n",
            "Norway                    | 100.0% |  42.2% |  19.2% |   8.1% |      3.3%\n",
            "Mexico                    |  55.8% |  27.2% |  13.6% |   6.3% |      2.9%\n",
            "Switzerland               |  63.6% |  32.1% |  14.1% |   6.5% |      2.7%\n",
            "Belgium                   |  55.0% |  35.0% |  13.0% |   5.7% |      2.3%\n",
            "Croatia                   |  41.5% |  14.0% |   7.8% |   3.4% |      1.4%\n",
            "Canada                    | 100.0% |  41.4% |  12.8% |   4.2% |      1.3%\n",
            "Senegal                   |  45.0% |  26.4% |   8.6% |   3.4% |      1.2%\n",
            "Ecuador                   |  44.2% |  18.8% |   8.1% |   3.3% |      1.2%\n",
            "Paraguay                  | 100.0% |  24.9% |  11.2% |   3.7% |      1.1%\n",
            "USA                       |  63.3% |  27.3% |   8.0% |   2.8% |      0.9%\n",
            "Australia                 |  50.8% |  15.8% |   6.4% |   2.3% |      0.7%\n",
            "Egypt                     |  49.2% |  14.5% |   5.8% |   2.0% |      0.7%\n",
            "Austria                   |  23.3% |   9.2% |   4.7% |   1.7% |      0.6%\n",
            "Algeria                   |  36.4% |  14.1% |   4.4% |   1.4% |      0.4%\n",
            "DR Congo                  |  26.0% |   9.2% |   3.0% |   0.8% |      0.2%\n",
            "Bosnia and Herzegovina    |  36.7% |  11.3% |   2.3% |   0.6% |      0.1%\n",
            "Cape Verde                |  16.4% |   6.4% |   1.9% |   0.5% |      0.1%\n",
            "Ghana                     |  22.5% |   6.8% |   1.6% |   0.4% |      0.1%\n",
            "South Africa              |   0.0% |   0.0% |   0.0% |   0.0% |      0.0%\n",
            "Germany                   |   0.0% |   0.0% |   0.0% |   0.0% |      0.0%\n",
            "Netherlands               |   0.0% |   0.0% |   0.0% |   0.0% |      0.0%\n",
            "Japan                     |   0.0% |   0.0% |   0.0% |   0.0% |      0.0%\n",
            "Sweden                    |   0.0% |   0.0% |   0.0% |   0.0% |      0.0%\n",
            "Ivory Coast               |   0.0% |   0.0% |   0.0% |   0.0% |      0.0%\n"
          ]
        }
      ]
    },
    {
      "cell_type": "markdown",
      "source": [
        "## 4. Brazil's Path to Glory: Opponent Analysis\n",
        "\n",
        "This section analyzes Brazil's potential matchups at each stage of the knockout bracket. Given Brazil's position in the bracket, we identify all possible opponents they could face in the Round of 16, Quarter-finals, Semi-finals, and the Final.\n",
        "\n",
        "For each potential opponent, we simulate 5,000 matches against Brazil using the MCMC posterior parameters to calculate the probability of Brazil advancing.\n",
        "\n",
        "### Potential Opponents Bracket\n",
        "<div class=\"scrollable-diagram\">\n",
        "  <img src=\"./images/brazil_path.svg\" alt=\"Brazil's Path Bracket\">\n",
        "</div>"
      ],
      "metadata": {
        "id": "6927c288"
      }
    },
    {
      "cell_type": "code",
      "source": [
        "# List of possible opponents for Brazil at each stage\n",
        "brazil_opponents = {\n",
        "    \"Round of 16\": [\"Ivory Coast\", \"Norway\"],\n",
        "    \"Quarter-finals\": [\"Mexico\", \"Ecuador\", \"England\", \"DR Congo\"],\n",
        "    \"Semi-finals\": [\"Argentina\", \"Cape Verde\", \"Australia\", \"Egypt\", \"Switzerland\", \"Algeria\", \"Colombia\", \"Ghana\"],\n",
        "    \"Final\": [\n",
        "        \"Canada\", \"South Africa\", \"Netherlands\", \"Morocco\", \"Germany\", \"Paraguay\", \"France\", \"Sweden\",\n",
        "        \"Portugal\", \"Croatia\", \"Spain\", \"Austria\", \"USA\", \"Bosnia and Herzegovina\", \"Belgium\", \"Senegal\"\n",
        "    ]\n",
        "}\n",
        "\n",
        "brazil_matchup_results = {\n",
        "    \"Round of 16\": {},\n",
        "    \"Quarter-finals\": {},\n",
        "    \"Semi-finals\": {},\n",
        "    \"Final\": {}\n",
        "}\n",
        "\n",
        "print(\"--- BRAZIL PATH ANALYSIS (5,000 SIMULATIONS PER OPPONENT) ---\")\n",
        "for stage, opponents in brazil_opponents.items():\n",
        "    print(f\"\\nStage: {stage}\")\n",
        "    print(f\"{'Opponent':25} | {'Brazil Win %':12} | {'Opponent Win %':14}\")\n",
        "    print(\"-\" * 57)\n",
        "    for opp in sorted(opponents):\n",
        "        brazil_wins = 0\n",
        "        opp_wins = 0\n",
        "        for _ in range(5000):\n",
        "            idx = random.choice(posterior_indices)\n",
        "            _, _, outcome = simulate_match_mcmc(\"Brazil\", opp, idx)\n",
        "            if \"Brazil wins\" in outcome:\n",
        "                brazil_wins += 1\n",
        "            else:\n",
        "                opp_wins += 1\n",
        "        \n",
        "        brazil_pct = (brazil_wins / 5000) * 100\n",
        "        opp_pct = (opp_wins / 5000) * 100\n",
        "        brazil_matchup_results[stage][opp] = brazil_pct\n",
        "        print(f\"{opp:25} | {brazil_pct:10.1f}% | {opp_pct:12.1f}%\")\n",
        ""
      ],
      "metadata": {
        "id": "572a3c4c"
      },
      "execution_count": 6,
      "outputs": [
        {
          "name": "stdout",
          "output_type": "stream",
          "text": [
            "--- BRAZIL PATH ANALYSIS (5,000 SIMULATIONS PER OPPONENT) ---\n",
            "\n",
            "Stage: Round of 16\n",
            "Opponent                  | Brazil Win % | Opponent Win %\n",
            "---------------------------------------------------------\n",
            "Ivory Coast               |       65.3% |         34.7%\n",
            "Norway                    |       56.6% |         43.4%\n",
            "\n",
            "Stage: Quarter-finals\n",
            "Opponent                  | Brazil Win % | Opponent Win %\n",
            "---------------------------------------------------------\n",
            "DR Congo                  |       70.3% |         29.7%\n",
            "Ecuador                   |       58.1% |         41.9%\n",
            "England                   |       45.4% |         54.6%\n",
            "Mexico                    |       52.6% |         47.4%\n",
            "\n",
            "Stage: Semi-finals\n",
            "Opponent                  | Brazil Win % | Opponent Win %\n",
            "---------------------------------------------------------\n",
            "Algeria                   |       68.6% |         31.4%\n",
            "Argentina                 |       39.0% |         61.0%\n",
            "Australia                 |       65.4% |         34.6%\n",
            "Cape Verde                |       76.7% |         23.3%\n",
            "Colombia                  |       51.2% |         48.8%\n",
            "Egypt                     |       66.4% |         33.6%\n",
            "Ghana                     |       77.5% |         22.5%\n",
            "Switzerland               |       57.0% |         43.0%\n",
            "\n",
            "Stage: Final\n",
            "Opponent                  | Brazil Win % | Opponent Win %\n",
            "---------------------------------------------------------\n",
            "Austria                   |       63.6% |         36.4%\n",
            "Belgium                   |       58.4% |         41.6%\n",
            "Bosnia and Herzegovina    |       77.5% |         22.5%\n",
            "Canada                    |       67.2% |         32.8%\n",
            "Croatia                   |       57.8% |         42.2%\n",
            "France                    |       41.5% |         58.5%\n",
            "Germany                   |       56.4% |         43.6%\n",
            "Morocco                   |       59.5% |         40.5%\n",
            "Netherlands               |       50.8% |         49.2%\n",
            "Paraguay                  |       67.0% |         33.0%\n",
            "Portugal                  |       50.3% |         49.7%\n",
            "Senegal                   |       63.4% |         36.6%\n",
            "South Africa              |       79.6% |         20.4%\n",
            "Spain                     |       34.5% |         65.5%\n",
            "Sweden                    |       71.0% |         29.0%\n",
            "USA                       |       66.4% |         33.6%\n"
          ]
        }
      ]
    }
  ],
  "metadata": {
    "language_info": {
      "name": "python"
    }
  },
  "nbformat_minor": 2,
  "nbformat": 4
};

document.addEventListener('DOMContentLoaded', () => {
  initPyodide();
  loadNotebook();
  
  const runAllBtn = document.getElementById('run-all-btn');
  runAllBtn.addEventListener('click', runAllCells);
});

// Initialize Pyodide
async function initPyodide() {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const statusBadge = document.getElementById('status-badge');
  const runAllBtn = document.getElementById('run-all-btn');

  try {
    pyodideInstance = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/"
    });
    
    statusBadge.className = 'status-badge ready';
    statusText.textContent = 'Python Ready';
    runAllBtn.removeAttribute('disabled');
    
    // Enable all individual run buttons
    document.querySelectorAll('.btn-run-cell').forEach(btn => {
      btn.removeAttribute('disabled');
    });
  } catch (err) {
    console.error("Failed to load Pyodide:", err);
    statusText.textContent = 'Load Failed';
    statusDot.style.background = '#ef4444';
  }
}

// Fetch and Render Notebook
async function loadNotebook() {
  const container = document.getElementById('notebook-container');
  let notebook = null;
  
  try {
    const response = await fetch('soccer_predictions.ipynb');
    if (response.ok) {
      notebook = await response.json();
    } else {
      console.warn("Fetch failed, falling back to embedded notebook.");
      notebook = embeddedNotebook;
    }
  } catch (err) {
    console.warn("Fetch error (likely CORS on file://), falling back to embedded notebook:", err);
    notebook = embeddedNotebook;
  }

  try {
    container.innerHTML = '';
    
    let maxExecutionCount = 0;
    
    notebook.cells.forEach((cell, index) => {
      const cellEl = document.createElement('div');
      cellEl.className = `cell cell-${cell.cell_type}`;
      cellEl.dataset.index = index;
      
      if (cell.cell_type === 'markdown') {
        const markdownContent = cell.source.join('');
        const body = document.createElement('div');
        body.className = 'markdown-body';
        body.innerHTML = marked.parse(markdownContent);
        cellEl.appendChild(body);
      } else if (cell.cell_type === 'code') {
        const codeContent = cell.source.join('');
        
        if (cell.execution_count) {
          maxExecutionCount = Math.max(maxExecutionCount, cell.execution_count);
        }
        
        // Input Row
        const inputRow = document.createElement('div');
        inputRow.className = 'cell-input-row';
        
        const prompt = document.createElement('div');
        prompt.className = 'cell-prompt';
        prompt.id = `prompt-${index}`;
        prompt.textContent = cell.execution_count ? `In [${cell.execution_count}]:` : 'In [ ]:';
        
        const editorContainer = document.createElement('div');
        editorContainer.className = 'cell-editor-container';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'cell-textarea';
        textarea.value = codeContent;
        textarea.rows = 1;
        textarea.id = `code-${index}`;
        textarea.spellcheck = false;
        
        const runBtn = document.createElement('button');
        runBtn.className = 'btn-run-cell';
        runBtn.id = `run-btn-${index}`;
        runBtn.disabled = pyodideInstance === null;
        runBtn.title = 'Run cell (Ctrl+Enter)';
        runBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
        
        runBtn.addEventListener('click', () => {
          console.log("Run button clicked for cell index:", index);
          runCell(index);
        });
        
        editorContainer.appendChild(textarea);
        editorContainer.appendChild(runBtn);
        inputRow.appendChild(prompt);
        inputRow.appendChild(editorContainer);
        cellEl.appendChild(inputRow);
        
        // Output Row (initially hidden, unless there are pre-existing outputs)
        const outputRow = document.createElement('div');
        outputRow.className = 'cell-output-row';
        outputRow.id = `output-row-${index}`;
        outputRow.style.display = 'none';
        
        const outputPrompt = document.createElement('div');
        outputPrompt.className = 'cell-output-prompt';
        outputPrompt.id = `output-prompt-${index}`;
        outputPrompt.textContent = 'Out [ ]:';
        outputPrompt.style.visibility = 'hidden';
        
        const outputContent = document.createElement('div');
        outputContent.className = 'cell-output-content';
        outputContent.id = `output-content-${index}`;
        
        outputRow.appendChild(outputPrompt);
        outputRow.appendChild(outputContent);
        cellEl.appendChild(outputRow);

        // Render pre-existing outputs if they exist
        if (cell.outputs && cell.outputs.length > 0) {
          let outputText = '';
          let isError = false;
          let hasExecuteResult = false;
          
          cell.outputs.forEach(out => {
            if (out.output_type === 'stream') {
              outputText += out.text.join('');
            } else if (out.output_type === 'execute_result') {
              hasExecuteResult = true;
              if (out.data && out.data['text/plain']) {
                const resText = out.data['text/plain'].join('');
                if (outputText) {
                  outputText += '\n' + resText;
                } else {
                  outputText = resText;
                }
              }
            } else if (out.output_type === 'error') {
              isError = true;
              if (out.traceback) {
                outputText += out.traceback.join('\n');
              } else {
                outputText += `${out.ename}: ${out.evalue}`;
              }
            }
          });
          
          if (outputText.trim()) {
            outputContent.textContent = outputText.trim();
            if (isError) {
              outputContent.classList.add('error');
            }
            if (hasExecuteResult && cell.execution_count) {
              outputPrompt.textContent = `Out [${cell.execution_count}]:`;
              outputPrompt.style.visibility = 'visible';
            }
            outputRow.style.display = 'flex';
          }
        }
      }
      
      container.appendChild(cellEl);
      
      // Initialize CodeMirror after inserting into DOM
      if (cell.cell_type === 'code') {
        const textarea = document.getElementById(`code-${index}`);
        const editor = CodeMirror.fromTextArea(textarea, {
          mode: "python",
          lineNumbers: false,
          indentUnit: 4,
          viewportMargin: Infinity,
          lineWrapping: true,
          extraKeys: {
            "Ctrl-Enter": () => {
              console.log("Ctrl+Enter pressed for cell index:", index);
              runCell(index);
            }
          }
        });
        cellEl.editorInstance = editor;
      }
    });
    
    executionCount = maxExecutionCount;
    
    // Trigger MathJax typesetting if available
    if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
      MathJax.typesetPromise();
    }
  } catch (err) {
    console.error("Error rendering notebook:", err);
    container.innerHTML = `<div style="color: var(--error-text); background: var(--error-bg); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--error-border); font-family: var(--font-heading); font-weight: 600;">Error rendering notebook: ${err.message}</div>`;
  }
}

// Run a Single Cell
async function runCell(index) {
  console.log("runCell called for index:", index);
  
  try {
    if (!pyodideInstance) {
      console.warn("runCell aborted: pyodideInstance is not initialized yet.");
      return;
    }
    
    const runBtn = document.getElementById(`run-btn-${index}`);
    const prompt = document.getElementById(`prompt-${index}`);
    const outputRow = document.getElementById(`output-row-${index}`);
    const outputContent = document.getElementById(`output-content-${index}`);
    const outputPrompt = document.getElementById(`output-prompt-${index}`);
    const cellEl = document.querySelector(`.cell[data-index="${index}"]`);
    
    if (!cellEl) {
      console.error(`runCell error: cell element with data-index="${index}" not found.`);
      return;
    }
    if (!cellEl.editorInstance) {
      console.error(`runCell error: CodeMirror editorInstance not found on cell element.`);
      return;
    }
    
    const code = cellEl.editorInstance.getValue();
    console.log("Executing code:\n", code);
    
    // Show spinner
    runBtn.innerHTML = '<div class="spinner"></div>';
    runBtn.disabled = true;
    prompt.textContent = 'In [*]:';
    
    // Capture stdout/stderr
    let stdoutBuffer = '';
    let stderrBuffer = '';
    
    pyodideInstance.setStdout({
      batched: (text) => {
        stdoutBuffer += text + '\n';
      }
    });
    pyodideInstance.setStderr({
      batched: (text) => {
        stderrBuffer += text + '\n';
      }
    });
    
    try {
      const result = await pyodideInstance.runPythonAsync(code);
      
      executionCount++;
      prompt.textContent = `In [${executionCount}]:`;
      
      outputContent.className = 'cell-output-content';
      let outputText = '';
      
      if (stdoutBuffer) {
        outputText += stdoutBuffer;
      }
      
      if (stderrBuffer) {
        outputText += stderrBuffer;
      }
      
      if (result !== undefined && result !== null) {
        let cleanResult = '';
        if (pyodideInstance.isPyProxy(result)) {
          cleanResult = result.toString();
          result.destroy();
        } else {
          cleanResult = String(result);
        }
        
        if (cleanResult !== 'None') {
          outputPrompt.style.visibility = 'visible';
          outputPrompt.textContent = `Out [${executionCount}]:`;
          if (outputText) {
            outputText += '\n' + cleanResult;
          } else {
            outputText = cleanResult;
          }
        } else {
          outputPrompt.style.visibility = 'hidden';
        }
      } else {
        outputPrompt.style.visibility = 'hidden';
      }
      
      if (outputText.trim()) {
        outputContent.textContent = outputText.trim();
        outputRow.style.display = 'flex';
      } else {
        outputRow.style.display = 'none';
      }
    } catch (err) {
      executionCount++;
      prompt.textContent = `In [${executionCount}]:`;
      outputContent.className = 'cell-output-content error';
      outputContent.textContent = String(err);
      outputPrompt.style.visibility = 'hidden';
      outputRow.style.display = 'flex';
      console.error("Python execution error:", err);
    } finally {
      // Restore run button
      runBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
      runBtn.disabled = false;
    }
  } catch (jsErr) {
    console.error("JavaScript error in runCell:", jsErr);
    const outputRow = document.getElementById(`output-row-${index}`);
    const outputContent = document.getElementById(`output-content-${index}`);
    if (outputRow && outputContent) {
      outputContent.className = 'cell-output-content error';
      outputContent.textContent = `JavaScript Error: ${jsErr.message}\n${jsErr.stack}`;
      outputRow.style.display = 'flex';
    }
  }
}

// Run All Cells
async function runAllCells() {
  const codeCells = document.querySelectorAll('.cell-code');
  for (const cell of codeCells) {
    const index = parseInt(cell.dataset.index);
    await runCell(index);
  }
}
