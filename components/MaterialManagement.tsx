{isHistorySectionOpen && (
          <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
            {(() => {
              // 매일 23시 초기화 조건에 따른 필터링 로직 적용
              const displayLogs = (inventoryLogs || []).filter((log) => {
                const matchedItem = inventoryList.find(
                  (i) => i.id === log.inventory_id || i.name === log.item_name
                );
                const isConsumable = matchedItem?.type === '소모성';

                // 1. 소모성 자재는 매일 23시에 삭제 (23시 이후 갱신 대상)
                if (isConsumable) {
                  return false;
                }

                // 기자재 관련 조건 처리
                const logType = String(log.type);
                const hasIssue = logType.includes('이상알림');
                const isReturned = logType.includes('반납완료');

                // 2. 기자재는 이상유무 체크가 없고, 반납이 완료되었을시 삭제
                if (!hasIssue && isReturned) {
                  return false;
                }

                // 3. 기자재의 이상유무에 체크가 되어있고, 미반납일시 미삭제
                if (hasIssue && !isReturned) {
                  return true;
                }

                // 4. 기자재의 이상유무에 체크 되어있고, 반납일시 미삭제
                if (hasIssue && isReturned) {
                  return true;
                }

                // 그 외 (이상유무 없고 미반납 상태인 불출건 등)는 유지
                return true;
              });

              if (displayLogs.length === 0) {
                return (
                  <p className="text-xs text-[#64748B] text-center py-4">
                    등록된 최근 이력이 없습니다.
                  </p>
                );
              }

              return (
                <>
                  {isAdmin && (
                    <div className="flex items-center space-x-2 px-2 pb-1 text-[11px] text-[#64748B] border-b border-[#E2E5E9]">
                      <input 
                        type="checkbox" 
                        checked={selectedLogIds.length === displayLogs.length && displayLogs.length > 0} 
                        onChange={() => {
                          if (selectedLogIds.length === displayLogs.length) {
                            setSelectedLogIds([]);
                          } else {
                            setSelectedLogIds(displayLogs.map(l => String(l.id)));
                          }
                        }}
                        className="accent-[#243B5A] rounded shrink-0"
                      />
                      <span className="truncate">전체 선택</span>
                    </div>
                  )}

                  {displayLogs.map((log) => {
                    const isChecked = selectedLogIds.includes(String(log.id));
                    const matchedItem = inventoryList.find(i => i.id === log.inventory_id || i.name === log.item_name);
                    const isConsumable = matchedItem?.type === '소모성';

                    return (
                      <div key={log.id} className="bg-[#F5F6F8] rounded-md border border-[#E2E5E9] p-2.5 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 min-w-0 flex-1 w-full">
                          {isAdmin && (
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={() => toggleSelectLog(log.id)}
                              className="accent-[#243B5A] rounded shrink-0"
                            />
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            String(log.type).includes('이상알림') ? 'bg-red-100 text-red-800' : String(log.type).includes('불출') ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {log.type}
                          </span>
                          <div className="min-w-0 flex items-center space-x-1 flex-1">
                            <span className="font-bold text-[#1F2937] truncate">{log.item_name}</span>
                            <span className="text-xs font-semibold text-[#243B5A] shrink-0">({log.quantity}개)</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#E2E5E9]">
                          <span className="text-[10px] text-[#64748B] truncate mr-1">
                            {log.worker_name} ({new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                          </span>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            {log.type === '불출' && !isConsumable && (
                              <button
                                onClick={() => handleOpenReturnModal(log)}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold transition"
                              >
                                반납
                              </button>
                            )}

                            {isAdmin && (
                              <div className="flex items-center space-x-1 pl-1.5 border-l border-[#E2E5E9]">
                                <button
                                  onClick={() => handleOpenEditLog(log)}
                                  className="px-1.5 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-semibold transition"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleOpenDeleteLog(log.id)}
                                  className="px-1.5 py-0.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[10px] font-semibold transition"
                                >
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}
