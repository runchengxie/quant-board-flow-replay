# 归档输入契约

[English](archive-contract.md)

生产者是[quant-market-data-platform](https://github.com/runchengxie/quant-market-data-platform)，
[板块流运维文档](https://github.com/runchengxie/quant-market-data-platform/blob/main/docs/operations/board-flow.en.md)
维护无损导出、校验与恢复。本项目只读已有`board-flow-parquet-v1`目录，不import生产者源码，也不把数据复制进Git。

manifest列出表、日期或null、列顺序、SQLite类型、主键顺序、行数、字节数和SHA-256。
文件路径由表与日期推导，不能执行输入的路径或SQL。重复JSON键、重复表/分区、未知表、非法日期、
symlink、hash/大小/结构/行数不符及重复或空主键均拒绝。TEXT对应Arrow string，INTEGER为int64，REAL为float64。

六张表为schema_meta、board_catalog、board_catalog_daily、collection_run、flow_snapshot、flow_minute，
列/类型/主键映射在archive.py中明确固定。清单必须包含六表，单个日期允许没有分区，
未登记的Parquet文件拒绝读取；回放至少需要一个分钟分区。
消费者校验数据结构，不执行manifest SQL，也不负责SQLite结构恢复；恢复完整库使用生产者工具。

回放读取分钟代码、分类、时间、主力净流入、来源与归档时刻；名称和名单时刻只取当天目录。
分钟时间为上海本地09:31–11:30、13:01–15:00的整分钟，不接受offset或小数秒。
来源须为非空字符串，主力净流入须有限。来源时间必须带日期和时分秒，统一上海时区后比较范围。
发布入口前重算全部输入文件hash。hash仅证明字节一致，不证明供应商数值正确或生产者签名。

旧manifest允许没有producer元数据，不能据此补造源码版本。页面保留快照/hash、来源和采集时间范围。
缺当日名单时应有覆盖率未知，不借用未来名称。构建清单绑定输出文件与输入manifest，不修改current/latest或权威数据。

输出目录独占新建，先转移已验证的暂存文件，最后发布index.html。这不是多文件事务。
如在占用目录后中断，应保留不完整目录并选择新输出；不能删除未知内容或覆盖重试。
