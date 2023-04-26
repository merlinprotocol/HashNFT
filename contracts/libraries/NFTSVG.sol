// contracts/NFTSVG.sol
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./utils.sol";
import "base64-sol/base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

library NFTSVG {
    using SafeMath for uint256;
    string constant public BTC_SYMBOL = "\u20BF";

    struct SVGParams {
        address owner;
        uint256 tokenId;
        uint256 rewards;
        uint256 hashrate;
        string statu;
        string price;
    }

    function generateMetadata(
        SVGParams memory params
    ) external pure returns (string memory metadata) {
        metadata = string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(generateDefs(params)))
            )
        );
    }

    function generateDefs(
        SVGParams memory params
    ) private pure returns (string memory defs) {
        defs = string(
            abi.encodePacked(
                "{",
                '"name":"MerlinProtocol - HashNFT v2",',
                '"description":"HashNFT is the first Real World asset issued by Merlin Protocol. It realizes the whole process of investment computing power including pre-sale, observation period, delivery period and end on the chain through intelligent contract technology. The contract automatically settles funds and delivers output according to the state of the prophecy machine. By ensuring that the settlement process is open and transparent and that there is no misappropriation of assets, NFT holders will receive the same investment returns that real world miners enjoy in mining.",',
                '"image":"data:image/svg+xml;base64,',
                Base64.encode(bytes(generateSVG(params))),
                '"',
                "}"
            )
        );
    }

    function generateSVG(
        SVGParams memory params
    ) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<svg width="290" height="500" viewBox="0 0 290 500" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"> <defs> <filter id="f1"> <feImage result="p0" xlink:href="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMjkwJyBoZWlnaHQ9JzUwMCcgdmlld0JveD0nMCAwIDI5MCA1MDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+CiAgICA8cmVjdCB3aWR0aD0nMjkwcHgnIGhlaWdodD0nNTAwcHgnIGZpbGw9JyNBQzYxOUMnIC8+Cjwvc3ZnPg==" /> <feImage result="p1" xlink:href="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMjkwJyBoZWlnaHQ9JzUwMCcgdmlld0JveD0nMCAwIDI5MCA1MDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+CiAgICA8Y2lyY2xlIGN4PScxNycgY3k9JzI3Nicgcj0nMTIwcHgnIGZpbGw9JyNDNzU3OTMnIC8+Cjwvc3ZnPg==" />',
                '<feImage result="p2" xlink:href="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMjkwJyBoZWlnaHQ9JzUwMCcgdmlld0JveD0nMCAwIDI5MCA1MDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+CiAgICA8Y2lyY2xlIGN4PScyMzgnIGN5PScxMTInIHI9JzEyMHB4JyBmaWxsPScjNTE4NkJGJyAvPgo8L3N2Zz4=" /> <feImage result="p3" xlink:href="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMjkwJyBoZWlnaHQ9JzUwMCcgdmlld0JveD0nMCAwIDI5MCA1MDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+CiAgICA8Y2lyY2xlIGN4PScyMDcnIGN5PSc0NTInIHI9JzEwMHB4JyBmaWxsPScjNTE4NkJGJyAvPgo8L3N2Zz4=" /> <feBlend mode="overlay" in="p0" in2="p1" /> <feBlend mode="exclusion" in2="p2" /><feBlend mode="overlay" in2="p3" result="blendOut" /> <feGaussianBlur in="blendOut" stdDeviation="42" /> </filter> <clipPath id="corners"> <rect width="290" height="500" rx="20" ry="20" /> </clipPath> <path id="text-path-a" d="M40 12 H250 A28 28 0 0 1 278 40 V460 A28 28 0 0 1 250 488 H40 A28 28 0 0 1 12 460 V40 A28 28 0 0 1 40 12 z" /> <path id="minimap" d="M234 444C234 457.949 242.21 463 253 463" /> <filter id="top-region-blur"> <feGaussianBlur in="SourceGraphic" stdDeviation="24" /> </filter> <linearGradient id="grad-up" x1="1" x2="0" y1="1" y2="0"> <stop offset="0.0" stop-color="white" stop-opacity="1" /> <stop offset=".9" stop-color="white" stop-opacity="0" /> </linearGradient> <linearGradient id="grad-down" x1="0" x2="1" y1="0" y2="1"> <stop offset="0.0" stop-color="white" stop-opacity="1" /> <stop offset="0.9" stop-color="white" stop-opacity="0" /> "</linearGradient> <mask id="fade-up" maskContentUnits="objectBoundingBox"> <rect width="1" height="1" fill="url(#grad-up)" /> </mask> <mask id="fade-down" maskContentUnits="objectBoundingBox"> <rect width="1" height="1" fill="url(#grad-down)" /> </mask>',
                '<mask id="none" maskContentUnits="objectBoundingBox"> <rect width="1" height="1" fill="white" /> </mask> <linearGradient id="grad-symbol"> <stop offset="0.7" stop-color="white" stop-opacity="1" /> <stop offset=".95" stop-color="white" stop-opacity="0" /> </linearGradient> <mask id="fade-symbol" maskContentUnits="userSpaceOnUse"> <rect width="290px" height="200px" fill="url(#grad-symbol)" /> </mask> </defs> <g clip-path="url(#corners)"> <rect fill="1f9840" x="0px" y="0px" width="290px" height="500px" /> <rect style="filter: url(#f1)" x="0px" y="0px" width="290px" height="500px" /> <g style="filter:url(#top-region-blur); transform:scale(1.5); transform-origin:center top;"> <rect fill="none" x="0px" y="0px" width="290px" height="500px" /> <ellipse cx="50%" cy="0px" rx="180px" ry="120px" fill="#000" opacity="0.85" /> </g> <rect x="0" y="0" width="290" height="500" rx="20" ry="20" fill="rgba(0,0,0,0)" stroke="rgba(255,255,255,0.2)" /> </g><text text-rendering="optimizeSpeed"> <textPath startOffset="-100%" fill="white" font-family="\'Courier New\', monospace" font-size="10px" xlink:href="#text-path-a">Owner: ',
                utils.AddressToString(params.owner),
                '<animate additive="sum" attributeName="startOffset" from="0%" to="100%" begin="0s" dur="45s" repeatCount="indefinite" /> </textPath> <textPath startOffset="0%" fill="white" font-family="\'Courier New\', monospace" font-size="10px" xlink:href="#text-path-a">Owner: ',
                utils.AddressToString(params.owner),
                '<animate additive="sum" attributeName="startOffset" from="0%" to="100%" begin="0s" dur="45s" repeatCount="indefinite" /> </textPath> <textPath startOffset="50%" fill="white" font-family="\'Courier New\', monospace" font-size="10px" xlink:href="#text-path-a">MerlinProtocol brings Real-World Assets into web3.',
                '<animate additive="sum" attributeName="startOffset" from="0%" to="100%" begin="0s" dur="45s" repeatCount="indefinite" /> </textPath> <textPath startOffset="-50%" fill="white" font-family="\'Courier New\', monospace" font-size="10px" xlink:href="#text-path-a">MerlinProtocol brings real-world assets into web3. <animate additive="sum" attributeName="startOffset" from="0%" to="100%" begin="0s" dur="45s"',
                ' repeatCount="indefinite" /> </textPath> </text> <g mask="url(#fade-symbol)"> <rect fill="none" x="0px" y="0px" width="290px" height="200px" /> <text y="70px" x="32px" fill="white" font-family="\'Courier New\', monospace" font-weight="200" font-size="36px">HashNFT</text><text y="95px" x="35px" fill="white" font-family="\'Courier New\', monospace" font-weight="200" font-size="16px">Rewards: </text><text y="95px" x="115px" fill="white" font-family="\'Courier New\', monospace" font-weight="bold" font-size="16px">',
                string(abi.encodePacked(Strings.toString(params.rewards))),
                'sat</text> <text y="120px" x="35px" fill="white" font-family="\'Courier New\', monospace" font-weight="400" font-size="12px">',
                params.price,
                '</text> </g> <rect x="16" y="16" width="258" height="468" rx="20" ry="20" fill="rgba(0,0,0,0)" stroke="rgba(255,255,255,0.2)" /> <style> @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.55; } 100% { opacity: 1; } }',
                '#bitcoin { animation: blink 4s infinite; } </style> <g> <circle cx="145" cy="252" r="100" stroke="white" stroke-width="6" fill="none" /><text id="bitcoin" x="100" y="310" font-family="Arial, sans-serif" font-size="160" font-weight="bold" fill="white">',
                BTC_SYMBOL,
                '</text></g> <g style="transform:translate(29px, 384px)"> <rect width="120px" height="26px" rx="8px" ry="8px" fill="rgba(0,0,0,0.6)" /><text x="12px" y="17px" font-family="\'Courier New\', monospace" font-size="12px" fill="white"> <tspan fill="rgba(255,255,255,0.6)">Token ID: </tspan>',
                string(abi.encodePacked(Strings.toString(params.tokenId))),
                '</text> </g> <g style="transform:translate(29px, 414px)"> <rect width="160px" height="26px" rx="8px" ry="8px" fill="rgba(0,0,0,0.6)" /><text x="12px" y="17px" font-family="\'Courier New\', monospace" font-size="12px" fill="white"> <tspan fill="rgba(255,255,255,0.6)">Statu: </tspan>',
                params.statu,
                '</text> </g> <g style="transform:translate(29px, 444px)"> <rect width="160px" height="26px" rx="8px" ry="8px" fill="rgba(0,0,0,0.6)" /><text x="12px" y="17px" font-family="\'Courier New\', monospace" font-size="12px" fill="white"> <tspan fill="rgba(255,255,255,0.6)">Hashrate: </tspan>',
                string(abi.encodePacked(Strings.toString(params.hashrate))),
                ' TH/s </text> </g> </svg>'
            )
        );
    }
}
