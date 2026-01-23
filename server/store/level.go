package store

type LevelInfo struct {
	Level int
	Title string
}

func LevelForExp(exp int) LevelInfo {
	if exp < 0 {
		exp = 0
	}
	if exp <= 50 {
		return LevelInfo{Level: 1, Title: "萌新"}
	}
	if exp <= 200 {
		return LevelInfo{Level: 2, Title: "进阶"}
	}
	if exp < 1000 {
		return LevelInfo{Level: 3, Title: "老鸟"}
	}
	return LevelInfo{Level: 4, Title: "大佬"}
}
