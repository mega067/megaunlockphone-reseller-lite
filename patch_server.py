import re

with open('server.js', 'r') as f:
    code = f.read()

old_block = """          if (ucp && ucp.resellerPrice !== undefined) {
            resellerCost = parseFloat(ucp.resellerPrice);
            clientPrice = ucp.clientPrice !== undefined ? parseFloat(ucp.clientPrice) : 
                (customPrices[realServiceId] ? parseFloat(customPrices[realServiceId].clientPrice) : Math.ceil(resellerCost + parseFloat(clientMarkup)));
          } else if (customPrices[realServiceId]) {
            resellerCost = parseFloat(customPrices[realServiceId].resellerPrice);
            clientPrice = parseFloat(customPrices[realServiceId].clientPrice);
            service._CUSTOM_RESELLER = resellerCost.toString();
            service._CUSTOM_CLIENT = clientPrice.toString();
          } else {
            const activeMarkup = (dbUser.markup !== null && dbUser.markup !== undefined && !isNaN(dbUser.markup)) ? parseFloat(dbUser.markup) : parseFloat(resellerMarkup);
            resellerCost = Math.ceil(realCredit + activeMarkup);
            clientPrice = Math.ceil(resellerCost + parseFloat(clientMarkup));
            delete service._CUSTOM_RESELLER;
            delete service._CUSTOM_CLIENT;
          }"""

new_block = """          if (customPrices[realServiceId]) {
            service._CUSTOM_RESELLER = customPrices[realServiceId].resellerPrice.toString();
            service._CUSTOM_CLIENT = customPrices[realServiceId].clientPrice.toString();
          } else {
            delete service._CUSTOM_RESELLER;
            delete service._CUSTOM_CLIENT;
          }

          if (ucp && ucp.resellerPrice !== undefined) {
            resellerCost = parseFloat(ucp.resellerPrice);
            clientPrice = ucp.clientPrice !== undefined ? parseFloat(ucp.clientPrice) : 
                (customPrices[realServiceId] ? parseFloat(customPrices[realServiceId].clientPrice) : Math.ceil(resellerCost + parseFloat(clientMarkup)));
          } else if (customPrices[realServiceId]) {
            resellerCost = parseFloat(customPrices[realServiceId].resellerPrice);
            clientPrice = parseFloat(customPrices[realServiceId].clientPrice);
          } else {
            const activeMarkup = (dbUser.markup !== null && dbUser.markup !== undefined && !isNaN(dbUser.markup)) ? parseFloat(dbUser.markup) : parseFloat(resellerMarkup);
            resellerCost = Math.ceil(realCredit + activeMarkup);
            clientPrice = Math.ceil(resellerCost + parseFloat(clientMarkup));
          }"""

code = code.replace(old_block, new_block)

with open('server.js', 'w') as f:
    f.write(code)

print("Patch server successful!")
