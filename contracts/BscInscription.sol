// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BscInscription
 * @dev BSC 链上铭文铸造合约 - 币安人生
 * 
 * 铭文格式: {"p":"bsc-20","op":"mint","tick":"BSC-LIFE","amt":1000}
 * 
 * 功能:
 * - Free Mint (免费铸造)
 * - 每个钱包最多 mint 5 次
 * - 总量 21000 张
 * - 单次 mint 1 张 (包含 1000 个币安人生)
 */

contract BscInscription {
    // 铭文配置
    string public constant PROTOCOL = "bsc-20";
    string public constant OPERATION = "mint";
    string public constant TICKER = "BSC-LIFE";
    uint256 public constant AMOUNT_PER_INSCRIPTION = 1000;
    uint256 public constant MAX_SUPPLY = 21000;
    uint256 public constant MAX_PER_WALLET = 5;
    
    // 状态变量
    uint256 public totalMinted;
    mapping(address => uint256) public mintCount;
    mapping(uint256 => MintRecord) public mintRecords;
    
    // Mint 记录结构
    struct MintRecord {
        uint256 id;
        address minter;
        uint256 timestamp;
        string inscriptionData;
    }
    
    // 事件
    event InscriptionMinted(
        uint256 indexed id,
        address indexed minter,
        uint256 amount,
        string inscriptionData,
        uint256 timestamp
    );
    
    // 修饰符：检查 mint 限制
    modifier withinMintLimit() {
        require(mintCount[msg.sender] < MAX_PER_WALLET, "Max mint limit reached");
        require(totalMinted < MAX_SUPPLY, "Max supply reached");
        _;
    }
    
    /**
     * @dev Mint 铭文
     * 每次调用 mint 1 张铭文
     */
    function mint() external withinMintLimit {
        // 更新计数
        totalMinted++;
        mintCount[msg.sender]++;
        
        // 生成铭文数据
        string memory inscriptionData = _generateInscriptionData();
        
        // 记录 mint
        mintRecords[totalMinted] = MintRecord({
            id: totalMinted,
            minter: msg.sender,
            timestamp: block.timestamp,
            inscriptionData: inscriptionData
        });
        
        // 触发事件
        emit InscriptionMinted(
            totalMinted,
            msg.sender,
            AMOUNT_PER_INSCRIPTION,
            inscriptionData,
            block.timestamp
        );
    }
    
    /**
     * @dev 批量 mint（可选功能）
     * @param count mint 数量（最多 5 次）
     */
    function mintBatch(uint256 count) external {
        require(count > 0 && count <= MAX_PER_WALLET, "Invalid count");
        require(mintCount[msg.sender] + count <= MAX_PER_WALLET, "Exceeds max limit");
        require(totalMinted + count <= MAX_SUPPLY, "Exceeds max supply");
        
        for (uint256 i = 0; i < count; i++) {
            totalMinted++;
            mintCount[msg.sender]++;
            
            string memory inscriptionData = _generateInscriptionData();
            
            mintRecords[totalMinted] = MintRecord({
                id: totalMinted,
                minter: msg.sender,
                timestamp: block.timestamp,
                inscriptionData: inscriptionData
            });
            
            emit InscriptionMinted(
                totalMinted,
                msg.sender,
                AMOUNT_PER_INSCRIPTION,
                inscriptionData,
                block.timestamp
            );
        }
    }
    
    /**
     * @dev 查询地址已 mint 次数
     */
    function getMintCount(address minter) external view returns (uint256) {
        return mintCount[minter];
    }
    
    /**
     * @dev 查询地址剩余可 mint 次数
     */
    function getRemainingMints(address minter) external view returns (uint256) {
        uint256 used = mintCount[minter];
        return used < MAX_PER_WALLET ? MAX_PER_WALLET - used : 0;
    }
    
    /**
     * @dev 查询 mint 记录
     */
    function getMintRecord(uint256 id) external view returns (MintRecord memory) {
        require(id > 0 && id <= totalMinted, "Invalid record ID");
        return mintRecords[id];
    }
    
    /**
     * @dev 生成铭文数据
     * 格式: {"p":"bsc-20","op":"mint","tick":"BSC-LIFE","amt":1000}
     */
    function _generateInscriptionData() internal pure returns (string memory) {
        return string(abi.encodePacked(
            '{"p":"',
            PROTOCOL,
            '","op":"',
            OPERATION,
            '","tick":"',
            TICKER,
            '","amt":',
            _uint2str(AMOUNT_PER_INSCRIPTION),
            '}'
        ));
    }
    
    /**
     * @dev uint 转 string
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
